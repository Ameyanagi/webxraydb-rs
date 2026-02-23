//! **Ameyanagi** exact self-absorption suppression factor.
//!
//! Computes the exact Booth suppression ratio:
//!
//! ```text
//! R(E, χ) = χ_exp(E) / χ
//! ```
//!
//! using the full exponential expression (no series expansion, no inversion).

use std::f64::consts::PI;

use xraydb::{CrossSectionKind, XrayDb};

use crate::common::{SampleInfo, SelfAbsError};

/// Thickness input for Ameyanagi exact suppression.
#[derive(Debug, Clone, Copy)]
pub enum AmeyanagiThicknessInput {
    /// Direct thickness in cm.
    ThicknessCm(f64),
    /// Derive thickness from pellet mass and diameter.
    ///
    /// ```text
    /// d = m / (ρ π (D/2)^2)
    /// ```
    PelletMassDiameter { mass_g: f64, diameter_cm: f64 },
}

impl AmeyanagiThicknessInput {
    fn resolve_cm(&self, density_g_cm3: f64) -> Result<f64, SelfAbsError> {
        if density_g_cm3 <= 0.0 || !density_g_cm3.is_finite() {
            return Err(SelfAbsError::InsufficientData(
                "density must be finite and > 0".to_string(),
            ));
        }

        let d = match *self {
            Self::ThicknessCm(v) => v,
            Self::PelletMassDiameter {
                mass_g,
                diameter_cm,
            } => {
                if mass_g <= 0.0 || !mass_g.is_finite() {
                    return Err(SelfAbsError::InsufficientData(
                        "pellet mass must be finite and > 0".to_string(),
                    ));
                }
                if diameter_cm <= 0.0 || !diameter_cm.is_finite() {
                    return Err(SelfAbsError::InsufficientData(
                        "pellet diameter must be finite and > 0".to_string(),
                    ));
                }
                let area = PI * (diameter_cm * 0.5).powi(2);
                mass_g / (density_g_cm3 * area)
            }
        };

        if d <= 0.0 || !d.is_finite() {
            return Err(SelfAbsError::InsufficientData(
                "resolved thickness must be finite and > 0".to_string(),
            ));
        }
        Ok(d)
    }
}

/// Exact Ameyanagi suppression result.
#[derive(Debug, Clone)]
pub struct AmeyanagiSuppressionResult {
    /// Incident energy grid in eV.
    pub energies: Vec<f64>,
    /// Exact suppression factor R(E, χ) = χ_exp / χ.
    pub suppression_factor: Vec<f64>,
    /// Minimum R over the grid.
    pub r_min: f64,
    /// Maximum R over the grid.
    pub r_max: f64,
    /// Mean R over the grid.
    pub r_mean: f64,
    /// Fluorescence attenuation (cm^-1), weighted by emission branching.
    pub mu_f: f64,
    /// Effective sample thickness in cm.
    pub thickness_cm: f64,
    /// Geometry factor g = sin(phi)/sin(theta).
    pub geometry_g: f64,
    /// Beta factor β = d/sin(phi) in cm.
    pub beta: f64,
    /// Edge energy in eV.
    pub edge_energy: f64,
    /// Branching-weighted fluorescence energy in eV.
    pub fluorescence_energy_weighted: f64,
}

/// Settings for Ameyanagi exact suppression evaluation.
#[derive(Debug, Clone, Copy)]
pub struct AmeyanagiSuppressionSettings {
    /// Effective sample density in g/cm^3.
    pub density_g_cm3: f64,
    /// Incident angle φ in radians.
    pub phi_rad: f64,
    /// Fluorescence exit angle θ in radians.
    pub theta_rad: f64,
    /// Sample thickness input.
    pub thickness_input: AmeyanagiThicknessInput,
    /// Assumed finite EXAFS amplitude χ.
    pub chi_assumed: f64,
}

/// Compute exact self-absorption suppression factor:
///
/// ```text
/// R(E, χ) = (1/χ) * [ F(E, χ) - 1 ]
/// ```
///
/// with
///
/// ```text
/// F(E, χ) =
///   [ (1 - exp(-A(E,χ)β)) / (1 - exp(-α(E)β)) ]
///   * [ α(E)(1+χ) / A(E,χ) ]
///
/// A(E,χ) = α(E) + μ_a(E)χ
/// α(E)   = μ_T(E) + g μ_f
/// g      = sin(phi)/sin(theta)
/// β      = d/sin(phi)
/// ```
pub fn ameyanagi_suppression_exact(
    formula: &str,
    central_element: &str,
    edge: &str,
    energies_ev: &[f64],
    settings: AmeyanagiSuppressionSettings,
) -> Result<AmeyanagiSuppressionResult, SelfAbsError> {
    let density_g_cm3 = settings.density_g_cm3;
    let phi_rad = settings.phi_rad;
    let theta_rad = settings.theta_rad;
    let thickness_input = settings.thickness_input;
    let chi_assumed = settings.chi_assumed;

    if energies_ev.is_empty() {
        return Err(SelfAbsError::InsufficientData(
            "energy grid must not be empty".to_string(),
        ));
    }
    if chi_assumed == 0.0 || !chi_assumed.is_finite() {
        return Err(SelfAbsError::InsufficientData(
            "chi must be finite and non-zero".to_string(),
        ));
    }
    if !phi_rad.is_finite() || !theta_rad.is_finite() {
        return Err(SelfAbsError::InsufficientData(
            "angles must be finite".to_string(),
        ));
    }

    let sin_phi = phi_rad.sin();
    let sin_theta = theta_rad.sin();
    if sin_phi <= 0.0 || sin_theta <= 0.0 {
        return Err(SelfAbsError::InsufficientData(
            "angles must be in (0, pi) with positive sine".to_string(),
        ));
    }

    let thickness_cm = thickness_input.resolve_cm(density_g_cm3)?;
    let geometry_g = sin_phi / sin_theta;
    let beta = thickness_cm / sin_phi;

    let db = XrayDb::new();
    let info = SampleInfo::new(&db, formula, central_element, edge)?;

    let mass_fractions = composition_mass_fractions(&db, &info.composition)?;
    let w_absorber = mass_fractions
        .iter()
        .find_map(|(sym, w)| (sym == &info.central_symbol).then_some(*w))
        .ok_or_else(|| {
            SelfAbsError::InsufficientData(format!(
                "absorber {} not found in mass fractions",
                info.central_symbol
            ))
        })?;

    // Step 1/2: linear attenuation terms in cm^-1
    let mu_total = compound_mu_linear(&db, &mass_fractions, density_g_cm3, energies_ev)?;
    let mu_abs_mass = db.mu_elam(&info.central_symbol, energies_ev, CrossSectionKind::Photo)?;
    let mu_a: Vec<f64> = mu_abs_mass
        .iter()
        .map(|&mu_rho| density_g_cm3 * w_absorber * mu_rho)
        .collect();

    // Step 3: fluorescence attenuation weighted over emission lines.
    let (mu_f, fluorescence_energy_weighted) = weighted_fluorescence_mu(
        &db,
        &mass_fractions,
        density_g_cm3,
        &info.central_symbol,
        edge,
    )?;

    // Step 5 and final exact suppression formula.
    let mut r = Vec::with_capacity(energies_ev.len());
    let mut r_min = f64::INFINITY;
    let mut r_max = f64::NEG_INFINITY;
    let mut r_sum = 0.0;

    for i in 0..energies_ev.len() {
        let alpha = mu_total[i] + geometry_g * mu_f;
        let mu_a_i = mu_a[i];
        let a = alpha + mu_a_i * chi_assumed;

        let one_minus_exp_ab = one_minus_exp_neg(a * beta);
        let one_minus_exp_alphab = one_minus_exp_neg(alpha * beta);

        let denom_main = one_minus_exp_alphab;
        let denom_ratio = a;

        if denom_main.abs() < 1e-300 || denom_ratio.abs() < 1e-300 {
            return Err(SelfAbsError::InsufficientData(format!(
                "unstable denominator at index {i}"
            )));
        }

        let term1 = one_minus_exp_ab / denom_main;
        let term2 = alpha * (1.0 + chi_assumed) / denom_ratio;
        let ri = (term1 * term2 - 1.0) / chi_assumed;

        if !ri.is_finite() {
            return Err(SelfAbsError::InsufficientData(format!(
                "non-finite suppression factor at index {i}"
            )));
        }

        r_min = r_min.min(ri);
        r_max = r_max.max(ri);
        r_sum += ri;
        r.push(ri);
    }

    let r_mean = r_sum / r.len() as f64;

    Ok(AmeyanagiSuppressionResult {
        energies: energies_ev.to_vec(),
        suppression_factor: r,
        r_min,
        r_max,
        r_mean,
        mu_f,
        thickness_cm,
        geometry_g,
        beta,
        edge_energy: info.edge_energy,
        fluorescence_energy_weighted,
    })
}

fn composition_mass_fractions(
    db: &XrayDb,
    composition: &std::collections::HashMap<String, f64>,
) -> Result<Vec<(String, f64)>, SelfAbsError> {
    let mut masses = Vec::with_capacity(composition.len());
    let mut total = 0.0;

    for (sym, &count) in composition {
        let mm = db.molar_mass(sym)?;
        let mass = count * mm;
        masses.push((sym.clone(), mass));
        total += mass;
    }

    if total <= 0.0 || !total.is_finite() {
        return Err(SelfAbsError::InsufficientData(
            "formula produced non-positive total mass".to_string(),
        ));
    }

    Ok(masses
        .into_iter()
        .map(|(sym, m)| (sym, m / total))
        .collect())
}

fn compound_mu_linear(
    db: &XrayDb,
    mass_fractions: &[(String, f64)],
    density_g_cm3: f64,
    energies_ev: &[f64],
) -> Result<Vec<f64>, SelfAbsError> {
    let mut mu_comp_mass = vec![0.0f64; energies_ev.len()];
    for (sym, &w) in mass_fractions.iter().map(|(s, w)| (s, w)) {
        let mu = db.mu_elam(sym, energies_ev, CrossSectionKind::Photo)?;
        for (i, &v) in mu.iter().enumerate() {
            mu_comp_mass[i] += w * v;
        }
    }
    Ok(mu_comp_mass
        .into_iter()
        .map(|mu_rho| density_g_cm3 * mu_rho)
        .collect())
}

fn weighted_fluorescence_mu(
    db: &XrayDb,
    mass_fractions: &[(String, f64)],
    density_g_cm3: f64,
    central_symbol: &str,
    edge: &str,
) -> Result<(f64, f64), SelfAbsError> {
    let lines = db.xray_lines(central_symbol, Some(edge), None)?;
    let mut weighted_mu_f = 0.0;
    let mut weighted_energy = 0.0;
    let mut weight_sum = 0.0;

    for line in lines.values() {
        if !line.intensity.is_finite() || line.intensity <= 0.0 {
            continue;
        }
        let w = line.intensity;
        let mu_e = compound_mu_single_energy(db, mass_fractions, density_g_cm3, line.energy)?;
        weighted_mu_f += w * mu_e;
        weighted_energy += w * line.energy;
        weight_sum += w;
    }

    if weight_sum <= 0.0 {
        return Err(SelfAbsError::NoEmissionLines(format!(
            "{central_symbol} {edge} has no positive-intensity lines"
        )));
    }

    Ok((weighted_mu_f / weight_sum, weighted_energy / weight_sum))
}

fn compound_mu_single_energy(
    db: &XrayDb,
    mass_fractions: &[(String, f64)],
    density_g_cm3: f64,
    energy_ev: f64,
) -> Result<f64, SelfAbsError> {
    let mut mu_comp_mass = 0.0;
    for (sym, &w) in mass_fractions.iter().map(|(s, w)| (s, w)) {
        let mu = db.mu_elam(sym, &[energy_ev], CrossSectionKind::Photo)?;
        mu_comp_mass += w * mu[0];
    }
    Ok(density_g_cm3 * mu_comp_mass)
}

fn one_minus_exp_neg(x: f64) -> f64 {
    if x <= 0.0 {
        0.0
    } else if x > 700.0 {
        1.0
    } else {
        -(-x).exp_m1()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn energies() -> Vec<f64> {
        (7000..=8000).step_by(5).map(|e| e as f64).collect()
    }

    #[test]
    fn test_ameyanagi_exact_fe2o3() {
        let r = ameyanagi_suppression_exact(
            "Fe2O3",
            "Fe",
            "K",
            &energies(),
            AmeyanagiSuppressionSettings {
                density_g_cm3: 5.24,
                phi_rad: std::f64::consts::FRAC_PI_4,
                theta_rad: std::f64::consts::FRAC_PI_4,
                thickness_input: AmeyanagiThicknessInput::ThicknessCm(0.01),
                chi_assumed: 0.2,
            },
        )
        .unwrap();

        assert_eq!(r.energies.len(), r.suppression_factor.len());
        assert!(r.suppression_factor.iter().all(|v| v.is_finite()));
        assert!(r.r_min <= r.r_mean);
        assert!(r.r_mean <= r.r_max);
    }

    #[test]
    fn test_mass_diameter_matches_thickness() {
        let density: f64 = 5.24;
        let diameter: f64 = 1.0;
        let mass: f64 = 0.05;
        let d = mass / (density * PI * (diameter * 0.5).powi(2));

        let direct = ameyanagi_suppression_exact(
            "Fe2O3",
            "Fe",
            "K",
            &energies(),
            AmeyanagiSuppressionSettings {
                density_g_cm3: density,
                phi_rad: std::f64::consts::FRAC_PI_4,
                theta_rad: std::f64::consts::FRAC_PI_4,
                thickness_input: AmeyanagiThicknessInput::ThicknessCm(d),
                chi_assumed: 0.2,
            },
        )
        .unwrap();

        let pellet = ameyanagi_suppression_exact(
            "Fe2O3",
            "Fe",
            "K",
            &energies(),
            AmeyanagiSuppressionSettings {
                density_g_cm3: density,
                phi_rad: std::f64::consts::FRAC_PI_4,
                theta_rad: std::f64::consts::FRAC_PI_4,
                thickness_input: AmeyanagiThicknessInput::PelletMassDiameter {
                    mass_g: mass,
                    diameter_cm: diameter,
                },
                chi_assumed: 0.2,
            },
        )
        .unwrap();

        assert!((direct.thickness_cm - pellet.thickness_cm).abs() < 1e-14);
        assert!((direct.r_mean - pellet.r_mean).abs() < 1e-10);
    }

    #[test]
    fn test_thicker_sample_has_smaller_mean_r() {
        let thin = ameyanagi_suppression_exact(
            "Fe2O3",
            "Fe",
            "K",
            &energies(),
            AmeyanagiSuppressionSettings {
                density_g_cm3: 5.24,
                phi_rad: std::f64::consts::FRAC_PI_4,
                theta_rad: std::f64::consts::FRAC_PI_4,
                thickness_input: AmeyanagiThicknessInput::ThicknessCm(1e-4),
                chi_assumed: 0.2,
            },
        )
        .unwrap();

        let thick = ameyanagi_suppression_exact(
            "Fe2O3",
            "Fe",
            "K",
            &energies(),
            AmeyanagiSuppressionSettings {
                density_g_cm3: 5.24,
                phi_rad: std::f64::consts::FRAC_PI_4,
                theta_rad: std::f64::consts::FRAC_PI_4,
                thickness_input: AmeyanagiThicknessInput::ThicknessCm(0.2),
                chi_assumed: 0.2,
            },
        )
        .unwrap();

        assert!(thick.r_mean < thin.r_mean);
    }

    #[test]
    fn test_positive_chi_gives_positive_suppression_factor() {
        let r = ameyanagi_suppression_exact(
            "Fe2O3",
            "Fe",
            "K",
            &energies(),
            AmeyanagiSuppressionSettings {
                density_g_cm3: 5.24,
                phi_rad: std::f64::consts::FRAC_PI_4,
                theta_rad: std::f64::consts::FRAC_PI_4,
                thickness_input: AmeyanagiThicknessInput::ThicknessCm(0.01),
                chi_assumed: 0.2,
            },
        )
        .unwrap();

        assert!(
            r.suppression_factor.iter().all(|&v| v.is_finite() && v > 0.0),
            "expected all R(E,chi)>0 for positive chi"
        );
    }

    #[test]
    fn test_thick_limit_matches_booth_eq6_ratio() {
        let energies = energies();
        let chi = 0.2;
        let density = 5.24;
        let phi = std::f64::consts::FRAC_PI_4;
        let theta = std::f64::consts::FRAC_PI_4;
        let thickness_cm = 0.5;

        let exact = ameyanagi_suppression_exact(
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

        let db = XrayDb::new();
        let info = SampleInfo::new(&db, "Fe2O3", "Fe", "K").unwrap();
        let mass_fractions = composition_mass_fractions(&db, &info.composition).unwrap();
        let w_absorber = mass_fractions
            .iter()
            .find_map(|(sym, w)| (sym == &info.central_symbol).then_some(*w))
            .unwrap();
        let mu_total = compound_mu_linear(&db, &mass_fractions, density, &energies).unwrap();
        let mu_abs_mass = db
            .mu_elam(&info.central_symbol, &energies, CrossSectionKind::Photo)
            .unwrap();
        let mu_a: Vec<f64> = mu_abs_mass
            .iter()
            .map(|&mu_rho| density * w_absorber * mu_rho)
            .collect();
        let (mu_f, _) =
            weighted_fluorescence_mu(&db, &mass_fractions, density, &info.central_symbol, "K")
                .unwrap();
        let g = phi.sin() / theta.sin();

        let mut max_abs_err = 0.0f64;
        for i in 0..energies.len() {
            let alpha = mu_total[i] + g * mu_f;
            let s = mu_a[i] / alpha;
            let thick_ratio = (1.0 - s) / (1.0 + s * chi);
            let err = (exact.suppression_factor[i] - thick_ratio).abs();
            if err > max_abs_err {
                max_abs_err = err;
            }
        }

        assert!(
            max_abs_err < 1e-6,
            "thick-limit mismatch too large: {max_abs_err}"
        );
    }

    #[test]
    fn test_zero_chi_is_error() {
        let e = ameyanagi_suppression_exact(
            "Fe2O3",
            "Fe",
            "K",
            &energies(),
            AmeyanagiSuppressionSettings {
                density_g_cm3: 5.24,
                phi_rad: std::f64::consts::FRAC_PI_4,
                theta_rad: std::f64::consts::FRAC_PI_4,
                thickness_input: AmeyanagiThicknessInput::ThicknessCm(0.01),
                chi_assumed: 0.0,
            },
        )
        .unwrap_err();
        assert!(format!("{e}").contains("chi"));
    }
}
