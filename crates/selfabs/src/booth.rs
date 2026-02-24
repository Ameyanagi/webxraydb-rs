//! **Booth** algorithm (C.H. Booth & F. Bridges, Phys. Scr. T115, 2005, 202).
//!
//! The most physically complete χ(k) correction. Handles both thin and thick
//! samples. In the thick limit, includes a nonlinear `s × (χ+1)` term that
//! Tröger omits.

use xraydb::XrayDb;

use crate::common::{
    FluorescenceGeometry, SampleInfo, SelfAbsError, absorber_edge_mu_linear_trendline,
    composition_mass_fractions, compound_mu_linear, compound_mu_linear_single, energies_to_k,
    weighted_mu_absorber, weighted_mu_total, weighted_mu_total_single,
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
    /// s(k) = μ̄_a(k) / α(k) at each point.
    pub s: Vec<f64>,
    /// α(k) = μ_total(k) + g × μ_f at each point (cm²/g-equiv).
    pub alpha: Vec<f64>,
    /// sin(θ_incident) — stored for correct_chi thin-sample correction.
    pub sin_phi: f64,
    /// Edge energy (eV).
    pub edge_energy: f64,
    /// Fluorescence energy (eV).
    pub fluorescence_energy: f64,
}

/// Booth suppression-ratio result for reference plotting.
pub struct BoothSuppressionResult {
    /// Energy grid (eV).
    pub energies: Vec<f64>,
    /// Suppression ratio R(E, χ) = χ_exp / χ_true.
    pub suppression_factor: Vec<f64>,
    /// Minimum R over grid.
    pub r_min: f64,
    /// Maximum R over grid.
    pub r_max: f64,
    /// Mean R over grid.
    pub r_mean: f64,
    /// Whether thick branch was used by Booth.
    pub is_thick: bool,
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

    /// Compute suppression ratio `R(E, χ) = χ_exp / χ_true` point-by-point.
    ///
    /// For thick samples this is closed-form:
    /// `R = (1 - s) / (1 + s χ_true)`.
    ///
    /// For thin samples this is obtained by numerically inverting the Booth
    /// thin correction formula at each energy point.
    pub fn suppression_factor(
        &self,
        chi_true: f64,
        density: f64,
        thickness_um: f64,
    ) -> Result<Vec<f64>, SelfAbsError> {
        if !chi_true.is_finite() || chi_true == 0.0 {
            return Err(SelfAbsError::InsufficientData(
                "chi_true must be finite and non-zero".to_string(),
            ));
        }

        if self.is_thick {
            let mut out = Vec::with_capacity(self.s.len());
            for &si in &self.s {
                let denom = 1.0 + si * chi_true;
                if denom.abs() < 1e-12 || !denom.is_finite() {
                    return Err(SelfAbsError::InsufficientData(
                        "unstable thick-limit denominator while computing suppression".to_string(),
                    ));
                }
                out.push((1.0 - si) / denom);
            }
            return Ok(out);
        }

        let mut out = Vec::with_capacity(self.s.len());
        for i in 0..self.s.len() {
            let chi_exp = self.solve_chi_exp_thin(i, chi_true, density, thickness_um)?;
            out.push(chi_exp / chi_true);
        }
        Ok(out)
    }

    fn correct_thick(&self, chi: &[f64]) -> Vec<f64> {
        chi.iter()
            .enumerate()
            .map(|(i, &c)| self.correct_single_thick(i, c))
            .collect()
    }

    fn correct_thin(&self, chi: &[f64], density: f64, thickness_um: f64) -> Vec<f64> {
        chi.iter()
            .enumerate()
            .map(|(i, &c)| self.correct_single_thin(i, c, density, thickness_um))
            .collect()
    }

    fn correct_single_thick(&self, i: usize, chi_exp: f64) -> f64 {
        let si = self.s[i];
        let denom = 1.0 - si * (chi_exp + 1.0);
        if denom.abs() > 1e-10 {
            chi_exp / denom
        } else {
            chi_exp
        }
    }

    fn correct_single_thin(&self, i: usize, chi_exp: f64, density: f64, thickness_um: f64) -> f64 {
        let thickness_cm = thickness_um * 1e-4;
        let alpha_i = self.alpha[i] * density;
        let mu_a_i = self.s[i] * alpha_i;
        // η = α × d / sin(φ)  [paper Eq. 5]
        let eta = alpha_i * thickness_cm / self.sin_phi;
        let exp_neg_eta = (-eta).exp();
        let beta = mu_a_i * exp_neg_eta * eta;
        let gamma = 1.0 - exp_neg_eta;

        if beta.abs() < 1e-30 {
            return chi_exp;
        }

        let term1 = gamma * (alpha_i - mu_a_i * (chi_exp + 1.0)) + beta;
        let term2 = 4.0 * alpha_i * beta * gamma * chi_exp;
        let discriminant = term1 * term1 + term2;

        if discriminant < 0.0 {
            chi_exp
        } else {
            (-term1 + discriminant.sqrt()) / (2.0 * beta)
        }
    }

    fn solve_chi_exp_thin(
        &self,
        i: usize,
        chi_true: f64,
        density: f64,
        thickness_um: f64,
    ) -> Result<f64, SelfAbsError> {
        let f = |x: f64| self.correct_single_thin(i, x, density, thickness_um) - chi_true;

        // Fast local solve near the physical branch.
        let mut x = chi_true;
        for _ in 0..20 {
            let fx = f(x);
            if !fx.is_finite() {
                break;
            }
            if fx.abs() < 1e-12 {
                return Ok(x);
            }
            let h = 1e-6 * x.abs().max(1.0);
            let df = (f(x + h) - f(x - h)) / (2.0 * h);
            if !df.is_finite() || df.abs() < 1e-12 {
                break;
            }
            let x_next = (x - fx / df).clamp(-0.999_999, 10.0);
            if !x_next.is_finite() {
                break;
            }
            if (x_next - x).abs() < 1e-12 {
                return Ok(x_next);
            }
            x = x_next;
        }

        // Robust fallback: bracket + bisection.
        let mut lo = -0.999_999;
        let mut hi = (chi_true.max(0.0) + 1.0) * 2.0;
        let mut flo = f(lo);
        let mut fhi = f(hi);

        let mut bracketed = flo.is_finite() && fhi.is_finite() && flo * fhi <= 0.0;
        if !bracketed {
            for _ in 0..40 {
                hi *= 2.0;
                if hi > 1e6 {
                    break;
                }
                fhi = f(hi);
                bracketed = flo.is_finite() && fhi.is_finite() && flo * fhi <= 0.0;
                if bracketed {
                    break;
                }
            }
        }

        if !bracketed {
            return Err(SelfAbsError::InsufficientData(format!(
                "failed to bracket thin Booth inversion at index {i}"
            )));
        }

        for _ in 0..80 {
            let mid = 0.5 * (lo + hi);
            let fmid = f(mid);
            if !fmid.is_finite() {
                return Err(SelfAbsError::InsufficientData(format!(
                    "non-finite thin Booth inversion function at index {i}"
                )));
            }
            if fmid.abs() < 1e-12 || (hi - lo).abs() < 1e-10 {
                return Ok(mid);
            }
            if flo * fmid <= 0.0 {
                hi = mid;
            } else {
                lo = mid;
                flo = fmid;
            }
        }

        Ok(0.5 * (lo + hi))
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

    // Determine thick vs thin: effective path = thickness / sin(φ)
    let sin_phi = geo.theta_incident_deg.to_radians().sin();
    let effective_path = thickness_um / sin_phi;
    let is_thick = effective_path >= THICK_LIMIT_UM;

    Ok(BoothResult {
        energies: energies.to_vec(),
        k,
        is_thick,
        s,
        alpha,
        sin_phi,
        edge_energy: info.edge_energy,
        fluorescence_energy: info.fluor_energy,
    })
}

/// Compute Booth reference suppression ratio `R(E, χ) = χ_exp/χ_true`.
#[allow(clippy::too_many_arguments)]
pub fn booth_suppression_reference(
    formula: &str,
    central_element: &str,
    edge: &str,
    energies: &[f64],
    geometry: Option<FluorescenceGeometry>,
    thickness_um: f64,
    density_g_cm3: f64,
    chi_true: f64,
) -> Result<BoothSuppressionResult, SelfAbsError> {
    if !density_g_cm3.is_finite() || density_g_cm3 <= 0.0 {
        return Err(SelfAbsError::InsufficientData(
            "density must be finite and > 0".to_string(),
        ));
    }
    if !thickness_um.is_finite() || thickness_um <= 0.0 {
        return Err(SelfAbsError::InsufficientData(
            "thickness_um must be finite and > 0".to_string(),
        ));
    }
    if !chi_true.is_finite() || chi_true == 0.0 {
        return Err(SelfAbsError::InsufficientData(
            "chi_true must be finite and non-zero".to_string(),
        ));
    }

    let db = XrayDb::new();
    let geo = geometry.unwrap_or_default();
    let info = SampleInfo::new(&db, formula, central_element, edge)?;
    let ratio = geo.ratio();

    let k = energies_to_k(energies, info.edge_energy);
    let mass_fractions = composition_mass_fractions(&db, &info.composition)?;
    let mu_t = compound_mu_linear(&db, &mass_fractions, density_g_cm3, energies)?;
    let mu_a = absorber_edge_mu_linear_trendline(&db, &info, energies, density_g_cm3)?;

    let lines = db.xray_lines(central_element, Some(edge), None)?;
    let mut mu_f_weighted = 0.0;
    let mut ef_weighted = 0.0;
    let mut w_sum = 0.0;
    for line in lines.values() {
        if !line.intensity.is_finite() || line.intensity <= 0.0 {
            continue;
        }
        let w = line.intensity;
        let mu_line = compound_mu_linear_single(&db, &mass_fractions, density_g_cm3, line.energy)?;
        mu_f_weighted += w * mu_line;
        ef_weighted += w * line.energy;
        w_sum += w;
    }
    if w_sum <= 0.0 {
        return Err(SelfAbsError::NoEmissionLines(format!(
            "{central_element} {edge} has no positive-intensity lines"
        )));
    }
    let mu_f = mu_f_weighted / w_sum;
    let fluorescence_energy = ef_weighted / w_sum;

    let mut s = Vec::with_capacity(energies.len());
    let mut alpha = Vec::with_capacity(energies.len());
    for i in 0..energies.len() {
        let alpha_linear = mu_t[i] + ratio * mu_f;
        let si = if alpha_linear > 0.0 {
            mu_a[i] / alpha_linear
        } else {
            0.0
        };
        alpha.push(alpha_linear / density_g_cm3);
        s.push(si);
    }

    let sin_phi = geo.theta_incident_deg.to_radians().sin();
    let effective_path = thickness_um / sin_phi;
    let is_thick = effective_path >= THICK_LIMIT_UM;

    let base = BoothResult {
        energies: energies.to_vec(),
        k,
        is_thick,
        s,
        alpha,
        sin_phi,
        edge_energy: info.edge_energy,
        fluorescence_energy,
    };

    let r = base.suppression_factor(chi_true, density_g_cm3, thickness_um)?;
    let r_min = r.iter().fold(f64::INFINITY, |m, &v| m.min(v));
    let r_max = r.iter().fold(f64::NEG_INFINITY, |m, &v| m.max(v));
    let r_mean = r.iter().sum::<f64>() / r.len() as f64;

    Ok(BoothSuppressionResult {
        energies: base.energies,
        suppression_factor: r,
        r_min,
        r_max,
        r_mean,
        is_thick: base.is_thick,
        edge_energy: base.edge_energy,
        fluorescence_energy: base.fluorescence_energy,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ameyanagi::{
        AmeyanagiSuppressionSettings, AmeyanagiThicknessInput, ameyanagi_suppression_exact,
    };

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

    #[test]
    fn test_booth_thick_suppression_matches_closed_form() {
        let energies: Vec<f64> = (7100..=8000).step_by(5).map(|e| e as f64).collect();
        let result = booth("Fe2O3", "Fe", "K", &energies, None, 100_000.0).unwrap();
        assert!(result.is_thick);

        let chi_true = 0.2;
        let r = result
            .suppression_factor(chi_true, 5.24, 100_000.0)
            .unwrap();

        for (i, &ri) in r.iter().enumerate() {
            let si = result.s[i];
            let expected = (1.0 - si) / (1.0 + si * chi_true);
            assert!(
                (ri - expected).abs() < 1e-12,
                "i={i}, ri={ri}, expected={expected}"
            );
        }
    }

    #[test]
    fn test_booth_thin_suppression_roundtrip() {
        let energies: Vec<f64> = (7100..=7600).step_by(5).map(|e| e as f64).collect();
        let thickness_um = 10.0;
        let density = 5.24;
        let chi_true = 0.2;

        let result = booth("Fe2O3", "Fe", "K", &energies, None, thickness_um).unwrap();
        assert!(!result.is_thick);

        let r = result
            .suppression_factor(chi_true, density, thickness_um)
            .unwrap();
        assert!(r.iter().all(|v| v.is_finite() && *v > 0.0));

        let chi_exp: Vec<f64> = r.iter().map(|ri| ri * chi_true).collect();
        let chi_corr = result.correct_chi(&chi_exp, density, thickness_um);
        for (i, &c) in chi_corr.iter().enumerate() {
            assert!(
                (c - chi_true).abs() < 1e-6,
                "roundtrip mismatch at {i}: {c}"
            );
        }
    }

    #[test]
    fn test_booth_reference_is_close_to_ameyanagi_after_mu_unification() {
        let energies: Vec<f64> = (7000..=8000).step_by(2).map(|e| e as f64).collect();
        let density = 5.24;
        let chi = 0.2;
        let thickness_cm = 0.01;
        let phi = std::f64::consts::FRAC_PI_4;
        let theta = std::f64::consts::FRAC_PI_4;

        let ameyanagi = ameyanagi_suppression_exact(
            "Fe2O3",
            "Fe",
            "K",
            &energies,
            AmeyanagiSuppressionSettings {
                density_g_cm3: density,
                phi_rad: phi,
                theta_rad: theta,
                thickness_input: AmeyanagiThicknessInput::ThicknessCm(thickness_cm),
                chi_assumed: chi,
            },
        )
        .unwrap();

        let booth_ref = booth_suppression_reference(
            "Fe2O3",
            "Fe",
            "K",
            &energies,
            None,
            thickness_cm * 1.0e4,
            density,
            chi,
        )
        .unwrap();

        let mean_abs_diff = ameyanagi
            .suppression_factor
            .iter()
            .zip(booth_ref.suppression_factor.iter())
            .map(|(a, b)| (a - b).abs())
            .sum::<f64>()
            / energies.len() as f64;

        assert!(
            mean_abs_diff < 0.12,
            "unexpectedly large A-vs-Booth-ref gap: {mean_abs_diff}"
        );
    }
}
