//! **Tröger** algorithm (L. Tröger et al., PRB 46:6, 1992, 3283).
//!
//! Simple χ(k) correction for thick samples.
//! Divides χ(k) by `1 − s(k)` where `s(k) = μ_absorber(k) / α(k)`.

use xraydb::XrayDb;

use crate::common::{
    FluorescenceGeometry, SampleInfo, SelfAbsError, energies_to_k, weighted_mu_absorber,
    weighted_mu_total, weighted_mu_total_single,
};

/// Result of the Tröger correction calculation.
pub struct TrogerResult {
    /// Energy grid (eV).
    pub energies: Vec<f64>,
    /// k grid (Å⁻¹); 0 for E ≤ E_edge.
    pub k: Vec<f64>,
    /// s(k) = μ_a(k) / α(k) at each point.
    pub s: Vec<f64>,
    /// Correction factor 1/(1 − s(k)) at each point.
    /// Multiply measured χ(k) by this to correct.
    pub correction_factor: Vec<f64>,
    /// Edge energy (eV).
    pub edge_energy: f64,
    /// Fluorescence energy (eV).
    pub fluorescence_energy: f64,
}

/// Compute the Tröger self-absorption correction.
///
/// ```text
/// α(k) = μ_total(k) + g × μ_f
/// s(k) = μ_absorber(k) / α(k)
/// χ_corrected(k) = χ_measured(k) / (1 − s(k))
/// ```
///
/// # Arguments
/// - `formula` — sample chemical formula
/// - `central_element` — absorbing element
/// - `edge` — absorption edge
/// - `energies` — energy grid in eV
/// - `geometry` — measurement geometry (default 45°/45°)
pub fn troger(
    formula: &str,
    central_element: &str,
    edge: &str,
    energies: &[f64],
    geometry: Option<FluorescenceGeometry>,
) -> Result<TrogerResult, SelfAbsError> {
    let db = XrayDb::new();
    let geo = geometry.unwrap_or_default();
    let info = SampleInfo::new(&db, formula, central_element, edge)?;
    let ratio = geo.ratio();

    let k = energies_to_k(energies, info.edge_energy);

    // μ_total(E) for all atoms
    let mu_t = weighted_mu_total(&db, &info.composition, energies)?;

    // μ_absorber(E) with pre-edge subtraction
    let mu_a = weighted_mu_absorber(&db, &info, energies, true)?;

    // μ_total at fluorescence energy
    let mu_f = weighted_mu_total_single(&db, &info.composition, info.fluor_energy)?;

    let n = energies.len();
    let mut s = Vec::with_capacity(n);
    let mut correction_factor = Vec::with_capacity(n);

    for i in 0..n {
        let alpha = mu_t[i] + ratio * mu_f;
        let si = if alpha > 0.0 { mu_a[i] / alpha } else { 0.0 };
        let cf = if (1.0 - si).abs() > 1e-10 {
            1.0 / (1.0 - si)
        } else {
            1.0
        };
        s.push(si);
        correction_factor.push(cf);
    }

    Ok(TrogerResult {
        energies: energies.to_vec(),
        k,
        s,
        correction_factor,
        edge_energy: info.edge_energy,
        fluorescence_energy: info.fluor_energy,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_troger_fe2o3() {
        let energies: Vec<f64> = (7000..=8000).step_by(5).map(|e| e as f64).collect();
        let result = troger("Fe2O3", "Fe", "K", &energies, None).unwrap();

        // s(k) should be between 0 and 1
        for (i, &si) in result.s.iter().enumerate() {
            if result.k[i] > 0.0 {
                assert!(
                    (0.0..1.0).contains(&si),
                    "s={si} out of range at k={}",
                    result.k[i]
                );
            }
        }

        // correction factor should be > 1 for concentrated samples above edge
        for (i, &cf) in result.correction_factor.iter().enumerate() {
            if result.k[i] > 0.0 {
                assert!(cf > 1.0, "correction={cf} should be > 1 above edge");
            }
        }
    }

    #[test]
    fn test_troger_dilute() {
        let energies: Vec<f64> = (7100..=7500).step_by(10).map(|e| e as f64).collect();
        let result = troger("Fe0.001Si0.999O2", "Fe", "K", &energies, None).unwrap();

        // For dilute sample, correction factor should be close to 1
        for &cf in &result.correction_factor {
            assert!(cf < 1.05, "dilute correction={cf} should be ~1");
        }
    }
}
