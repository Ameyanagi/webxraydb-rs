//! **Fluo** algorithm (Haskel, Ravel, Stern).
//!
//! The only algorithm that works in μ(E) space — applicable to XANES.
//! Corrects normalized μ(E) point-by-point using tabulated cross-sections.

use xraydb::{CrossSectionKind, XrayDb};

use crate::common::{
    weighted_mu_background, weighted_mu_total_single, FluorescenceGeometry, SampleInfo,
    SelfAbsError,
};

/// Parameters for the Fluo correction, precomputed from the sample.
pub struct FluoParams {
    /// β = μ_total(E_fluor) / μ_absorber(E+).
    pub beta: f64,
    /// γ' = μ_background(E+) / μ_absorber(E+).
    pub gamma_prime: f64,
    /// g = sin(θ_in) / sin(θ_out).
    pub ratio: f64,
    /// μ_background(E) / μ_absorber(E+) at each energy point.
    pub mu_background_norm: Vec<f64>,
    /// Edge energy (eV).
    pub edge_energy: f64,
    /// Fluorescence energy (eV).
    pub fluorescence_energy: f64,
}

/// Compute the Fluo correction parameters.
///
/// # Arguments
/// - `formula` — sample chemical formula
/// - `central_element` — absorbing element
/// - `edge` — absorption edge (e.g. `"K"`)
/// - `energies` — energy grid in eV
/// - `geometry` — measurement geometry (default 45°/45°)
///
/// # Returns
/// [`FluoParams`] that can be used with [`correct_mu`] to correct normalized μ(E) data.
pub fn fluo_params(
    formula: &str,
    central_element: &str,
    edge: &str,
    energies: &[f64],
    geometry: Option<FluorescenceGeometry>,
) -> Result<FluoParams, SelfAbsError> {
    let db = XrayDb::new();
    let geo = geometry.unwrap_or_default();
    let info = SampleInfo::new(&db, formula, central_element, edge)?;

    let ratio = geo.ratio();

    // E+ = slightly above the edge for reference cross-section
    let e_plus = info.edge_energy + 50.0;

    // μ_absorber at E+
    let mu_a_plus = {
        let mu = db.mu_elam(
            &info.central_symbol,
            &[e_plus],
            CrossSectionKind::Photo,
        )?;
        info.central_count * mu[0]
    };

    // μ_total at fluorescence energy
    let mu_f = weighted_mu_total_single(&db, &info.composition, info.fluor_energy)?;

    // μ_background(E+)
    let mu_b_plus = {
        let mu_bg = weighted_mu_background(&db, &info, &[e_plus])?;
        mu_bg[0]
    };

    let beta = mu_f / mu_a_plus;
    let gamma_prime = mu_b_plus / mu_a_plus;

    // μ_background(E) at each energy, normalized by μ_absorber(E+)
    let mu_bg_all = weighted_mu_background(&db, &info, energies)?;
    let mu_background_norm: Vec<f64> = mu_bg_all.iter().map(|&m| m / mu_a_plus).collect();

    Ok(FluoParams {
        beta,
        gamma_prime,
        ratio,
        mu_background_norm,
        edge_energy: info.edge_energy,
        fluorescence_energy: info.fluor_energy,
    })
}

/// Apply Fluo correction to normalized μ(E) data.
///
/// ```text
/// μ_corrected(E) = μ_norm(E) × [β × g + μ_b(E)/μ_a(E+)]
///                / [β × g + γ' + 1 − μ_norm(E)]
/// ```
///
/// `mu_norm` is the normalized absorption data (e.g. from Athena's normalization).
pub fn correct_mu(params: &FluoParams, mu_norm: &[f64]) -> Vec<f64> {
    let bg = &params.mu_background_norm;
    let beta_g = params.beta * params.ratio;
    let denom_const = beta_g + params.gamma_prime + 1.0;

    mu_norm
        .iter()
        .enumerate()
        .map(|(i, &mu)| {
            let bg_i = bg.get(i).copied().unwrap_or(params.gamma_prime);
            let numer = mu * (beta_g + bg_i);
            let denom = denom_const - mu;
            if denom.abs() < 1e-30 {
                mu
            } else {
                numer / denom
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fluo_params_fe2o3() {
        let energies: Vec<f64> = (7000..=7500).step_by(5).map(|e| e as f64).collect();
        let params = fluo_params("Fe2O3", "Fe", "K", &energies, None).unwrap();

        assert!(params.beta > 0.0);
        assert!(params.gamma_prime > 0.0);
        assert!((params.ratio - 1.0).abs() < 1e-10); // 45°/45°
        assert_eq!(params.mu_background_norm.len(), energies.len());
    }

    #[test]
    fn test_fluo_correction_identity() {
        // For a very dilute sample, correction should be near identity
        let energies: Vec<f64> = (7000..=7500).step_by(5).map(|e| e as f64).collect();
        let params = fluo_params("Fe0.001Si0.999O2", "Fe", "K", &energies, None).unwrap();

        // Simulate normalized mu data: 0 below edge, 1 above
        let mu_norm: Vec<f64> = energies
            .iter()
            .map(|&e| if e > params.edge_energy { 1.0 } else { 0.0 })
            .collect();

        let corrected = correct_mu(&params, &mu_norm);
        // For dilute sample, corrected ≈ original
        for (&orig, &corr) in mu_norm.iter().zip(corrected.iter()) {
            if orig > 0.0 {
                assert!(
                    (corr - orig).abs() < 0.15,
                    "dilute: orig={orig}, corr={corr}"
                );
            }
        }
    }
}
