//! **Booth** algorithm (C.H. Booth & F. Bridges, Phys. Scr. T115, 2005, 202).
//!
//! The most physically complete χ(k) correction. Handles both thin and thick
//! samples. In the thick limit, includes a nonlinear `s × (χ+1)` term that
//! Tröger omits.

use xraydb::XrayDb;

use crate::common::{
    energies_to_k, weighted_mu_absorber, weighted_mu_total, weighted_mu_total_single,
    FluorescenceGeometry, SampleInfo, SelfAbsError,
};

/// Thickness threshold (μm) for thin vs. thick determination.
/// Path length = thickness / sin(θ_in). If > this value, use thick formula.
const THICK_LIMIT_UM: f64 = 90.0;

/// Result of the Booth correction calculation.
pub struct BoothResult {
    /// Energy grid (eV).
    pub energies: Vec<f64>,
    /// k grid (Å⁻¹); 0 for E ≤ E_edge.
    pub k: Vec<f64>,
    /// Whether thick-sample formula was used.
    pub is_thick: bool,
    /// s(k) = μ_a(k) / α(k) at each point.
    pub s: Vec<f64>,
    /// α(k) = μ_total(k) + g × μ_f at each point.
    pub alpha: Vec<f64>,
    /// Edge energy (eV).
    pub edge_energy: f64,
    /// Fluorescence energy (eV).
    pub fluorescence_energy: f64,
}

impl BoothResult {
    /// Correct measured χ(k) using the Booth algorithm.
    ///
    /// **Thick sample:**
    /// ```text
    /// χ_corr = χ / (1 − s × (χ + 1))
    /// ```
    ///
    /// **Thin sample** (quadratic solution):
    /// ```text
    /// χ_corr = (−term1 + √(term1² + term2)) / (2β)
    /// ```
    pub fn correct_chi(&self, chi: &[f64], density: f64, thickness_um: f64) -> Vec<f64> {
        if self.is_thick {
            self.correct_thick(chi)
        } else {
            self.correct_thin(chi, density, thickness_um)
        }
    }

    fn correct_thick(&self, chi: &[f64]) -> Vec<f64> {
        chi.iter()
            .enumerate()
            .map(|(i, &c)| {
                let si = self.s[i];
                let denom = 1.0 - si * (c + 1.0);
                if denom.abs() > 1e-10 {
                    c / denom
                } else {
                    c
                }
            })
            .collect()
    }

    fn correct_thin(&self, chi: &[f64], density: f64, thickness_um: f64) -> Vec<f64> {
        let thickness_cm = thickness_um * 1e-4;

        chi.iter()
            .enumerate()
            .map(|(i, &c)| {
                let alpha_i = self.alpha[i] * density;
                let mu_a_i = self.s[i] * alpha_i;
                // η = thickness × α / sin(θ_in)
                // We store α without sin factor, so use α directly with thickness_cm
                let eta = thickness_cm * alpha_i;
                let exp_neg_eta = (-eta).exp();
                let beta = mu_a_i * exp_neg_eta * eta;
                let gamma = 1.0 - exp_neg_eta;

                if beta.abs() < 1e-30 {
                    return c;
                }

                let term1 = gamma * (alpha_i - mu_a_i * (c + 1.0)) + beta;
                let term2 = 4.0 * alpha_i * beta * gamma * c;
                let discriminant = term1 * term1 + term2;

                if discriminant < 0.0 {
                    c
                } else {
                    (-term1 + discriminant.sqrt()) / (2.0 * beta)
                }
            })
            .collect()
    }
}

/// Compute the Booth self-absorption correction parameters.
///
/// # Arguments
/// - `formula` — sample chemical formula
/// - `central_element` — absorbing element
/// - `edge` — absorption edge
/// - `energies` — energy grid in eV
/// - `geometry` — measurement geometry (default 45°/45°)
/// - `thickness_um` — sample thickness in μm (large value = thick limit)
pub fn booth(
    formula: &str,
    central_element: &str,
    edge: &str,
    energies: &[f64],
    geometry: Option<FluorescenceGeometry>,
    thickness_um: f64,
) -> Result<BoothResult, SelfAbsError> {
    let db = XrayDb::new();
    let geo = geometry.unwrap_or_default();
    let info = SampleInfo::new(&db, formula, central_element, edge)?;
    let ratio = geo.ratio();

    let k = energies_to_k(energies, info.edge_energy);

    // μ quantities (weighted by stoichiometric count, in cm²/g-equivalent)
    let mu_t = weighted_mu_total(&db, &info.composition, energies)?;
    let mu_a = weighted_mu_absorber(&db, &info, energies, true)?;
    let mu_f = weighted_mu_total_single(&db, &info.composition, info.fluor_energy)?;

    let n = energies.len();
    let mut s = Vec::with_capacity(n);
    let mut alpha = Vec::with_capacity(n);

    for i in 0..n {
        let alpha_i = mu_t[i] + ratio * mu_f;
        let si = if alpha_i > 0.0 {
            mu_a[i] / alpha_i
        } else {
            0.0
        };
        alpha.push(alpha_i);
        s.push(si);
    }

    // Determine thick vs thin: effective path = thickness / sin(θ_in)
    let effective_path = thickness_um / geo.theta_incident_deg.to_radians().sin();
    let is_thick = effective_path >= THICK_LIMIT_UM;

    Ok(BoothResult {
        energies: energies.to_vec(),
        k,
        is_thick,
        s,
        alpha,
        edge_energy: info.edge_energy,
        fluorescence_energy: info.fluor_energy,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_booth_thick_fe2o3() {
        let energies: Vec<f64> = (7000..=8000).step_by(5).map(|e| e as f64).collect();
        // 100 mm = effectively infinite thickness
        let result = booth("Fe2O3", "Fe", "K", &energies, None, 100_000.0).unwrap();

        assert!(result.is_thick);

        // s(k) should be 0..1 above edge
        for (i, &si) in result.s.iter().enumerate() {
            if result.k[i] > 0.0 {
                assert!((0.0..1.0).contains(&si), "s={si}");
            }
        }
    }

    #[test]
    fn test_booth_thin_sample() {
        let energies: Vec<f64> = (7000..=8000).step_by(5).map(|e| e as f64).collect();
        // 10 μm = thin
        let result = booth("Fe2O3", "Fe", "K", &energies, None, 10.0).unwrap();
        assert!(!result.is_thick);
    }

    #[test]
    fn test_booth_thick_correction() {
        let energies: Vec<f64> = (7100..=8000).step_by(5).map(|e| e as f64).collect();
        let result = booth("Fe2O3", "Fe", "K", &energies, None, 100_000.0).unwrap();

        // Simulate chi data
        let chi: Vec<f64> = result.k.iter().map(|&ki| 0.1 * (-0.5 * ki).exp()).collect();
        let corrected = result.correct_chi(&chi, 5.24, 100_000.0);

        // Corrected chi should be larger (self-absorption damps the signal)
        for (i, (&orig, &corr)) in chi.iter().zip(corrected.iter()).enumerate() {
            if result.k[i] > 0.0 && orig > 0.001 {
                assert!(corr >= orig, "corrected={corr} < original={orig}");
            }
        }
    }
}
