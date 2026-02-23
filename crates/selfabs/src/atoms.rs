//! **Atoms** algorithm (B. Ravel, J. Synch. Rad. 8:2, 2001, 314).
//!
//! The simplest correction: computes a single amplitude factor and σ² correction
//! from tabulated cross-sections. Does not require geometry.
//!
//! ```text
//! χ_corrected(k) = amplitude × χ_measured(k) × exp(σ²_net × k²)
//! ```

use xraydb::{CrossSectionKind, XrayDb};

use crate::common::{
    SampleInfo, SelfAbsError, energies_to_k, fit_ln_vs_x, weighted_mu_background,
    weighted_mu_total_single,
};

/// Result of the Atoms correction calculation.
pub struct AtomsResult {
    /// Energy grid used (eV).
    pub energies: Vec<f64>,
    /// k grid (Å⁻¹).
    pub k: Vec<f64>,
    /// Self-absorption correction factor σ(E) at each energy.
    pub correction: Vec<f64>,
    /// Self-absorption amplitude factor (exp(intercept)).
    pub amplitude: f64,
    /// Self-absorption σ² (Å²).
    pub sigma_squared_self: f64,
    /// Normalization (McMaster) σ² (Å²).
    pub sigma_squared_norm: f64,
    /// I₀ fill gas σ² (Å²) — assumes N₂ gas.
    pub sigma_squared_i0: f64,
    /// Net σ² = self + norm + i0 (Å²).
    pub sigma_squared_net: f64,
    /// Edge energy (eV).
    pub edge_energy: f64,
    /// Fluorescence energy (eV).
    pub fluorescence_energy: f64,
}

impl AtomsResult {
    /// Apply correction to measured χ(k).
    ///
    /// ```text
    /// χ_corrected(k) = amplitude × χ(k) × exp(σ²_net × k²)
    /// ```
    pub fn correct_chi(&self, chi: &[f64]) -> Vec<f64> {
        chi.iter()
            .enumerate()
            .map(|(i, &c)| {
                let ki = self.k.get(i).copied().unwrap_or(0.0);
                self.amplitude * c * (self.sigma_squared_net * ki * ki).exp()
            })
            .collect()
    }
}

/// Compute the Atoms self-absorption correction.
///
/// This is the simplest algorithm: it computes three σ² corrections
/// (self-absorption, normalization, I₀ gas) and a single amplitude factor.
///
/// # Arguments
/// - `formula` — sample chemical formula
/// - `central_element` — absorbing element
/// - `edge` — absorption edge
/// - `energies` — energy grid in eV
pub fn atoms(
    formula: &str,
    central_element: &str,
    edge: &str,
    energies: &[f64],
) -> Result<AtomsResult, SelfAbsError> {
    let db = XrayDb::new();
    let info = SampleInfo::new(&db, formula, central_element, edge)?;

    let k = energies_to_k(energies, info.edge_energy);

    // --- Self-absorption correction ---
    // σ(E) = (μ_f + μ_total(E)) / (μ_f + μ_background(E))
    // where μ_f = total absorption at fluorescence energy
    let mu_f = weighted_mu_total_single(&db, &info.composition, info.fluor_energy)?;
    let mu_bg = weighted_mu_background(&db, &info, energies)?;

    // Full mu of central element (no pre-edge subtraction for the Atoms formula)
    let mu_central = {
        let mu = db.mu_elam(&info.central_symbol, energies, CrossSectionKind::Photo)?;
        mu.iter()
            .map(|&m| info.central_count * m)
            .collect::<Vec<_>>()
    };

    let n = energies.len();
    let mut correction = Vec::with_capacity(n);
    for i in 0..n {
        let mu_total_i = mu_central[i] + mu_bg[i];
        let denom = mu_f + mu_bg[i];
        let sigma = if denom > 0.0 {
            (mu_f + mu_total_i) / denom
        } else {
            1.0
        };
        correction.push(sigma);
    }

    // Fit ln(σ) vs k → amplitude = exp(intercept), σ²_self = -slope/2
    let (intercept_self, slope_self) = fit_ln_vs_x(&k, &correction);
    let amplitude = intercept_self.exp();
    let sigma_squared_self = -slope_self / 2.0;

    // --- McMaster normalization correction ---
    // Fits the energy-dependent cross-section of the absorber above the edge
    let mu_central_above: Vec<f64> = (0..n)
        .map(|i| if k[i] > 0.0 { mu_central[i] } else { 0.0 })
        .collect();
    let (_, slope_norm) = fit_ln_vs_x(&k, &mu_central_above);
    let sigma_squared_norm = -slope_norm / 2.0;

    // --- I₀ fill gas correction ---
    // Assumes 100% N₂ in the ionization chamber
    let mu_n2: Vec<f64> = {
        let mu = db.mu_elam("N", energies, CrossSectionKind::Photo)?;
        mu.iter().map(|&m| 2.0 * m).collect() // N₂
    };
    let mu_n2_above: Vec<f64> = (0..n)
        .map(|i| if k[i] > 0.0 { mu_n2[i] } else { 0.0 })
        .collect();
    let (_, slope_i0) = fit_ln_vs_x(&k, &mu_n2_above);
    let sigma_squared_i0 = -slope_i0 / 2.0;

    let sigma_squared_net = sigma_squared_self + sigma_squared_norm + sigma_squared_i0;

    Ok(AtomsResult {
        energies: energies.to_vec(),
        k,
        correction,
        amplitude,
        sigma_squared_self,
        sigma_squared_norm,
        sigma_squared_i0,
        sigma_squared_net,
        edge_energy: info.edge_energy,
        fluorescence_energy: info.fluor_energy,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_atoms_fe2o3() {
        let energies: Vec<f64> = (7000..=8000).step_by(5).map(|e| e as f64).collect();
        let result = atoms("Fe2O3", "Fe", "K", &energies).unwrap();

        assert!(result.amplitude > 1.0, "amplitude={}", result.amplitude);
        assert_eq!(result.correction.len(), energies.len());
        assert!((result.edge_energy - 7112.0).abs() < 2.0);
    }

    #[test]
    fn test_atoms_dilute() {
        let energies: Vec<f64> = (7100..=7500).step_by(10).map(|e| e as f64).collect();
        let result = atoms("Fe0.001Si0.999O2", "Fe", "K", &energies).unwrap();

        // Dilute: amplitude close to 1, sigma² close to 0
        assert!(
            (result.amplitude - 1.0).abs() < 0.05,
            "dilute amplitude={}",
            result.amplitude
        );
    }

    #[test]
    fn test_atoms_correction_components() {
        let energies: Vec<f64> = (7000..=8000).step_by(5).map(|e| e as f64).collect();
        let result = atoms("Fe2O3", "Fe", "K", &energies).unwrap();

        // Net σ² should be the sum of components
        let expected =
            result.sigma_squared_self + result.sigma_squared_norm + result.sigma_squared_i0;
        assert!(
            (result.sigma_squared_net - expected).abs() < 1e-15,
            "net={}, expected={}",
            result.sigma_squared_net,
            expected
        );
    }

    #[test]
    fn test_atoms_pure_element() {
        let energies: Vec<f64> = (7000..=8000).step_by(5).map(|e| e as f64).collect();
        let result = atoms("Fe", "Fe", "K", &energies).unwrap();

        // Pure element should have large correction
        assert!(result.amplitude > 1.0);
        // Correction factor should be > 1 for all post-edge points
        for (i, &c) in result.correction.iter().enumerate() {
            if result.k[i] > 0.0 {
                assert!(c > 1.0, "correction={c} at k={}", result.k[i]);
            }
        }
    }
}
