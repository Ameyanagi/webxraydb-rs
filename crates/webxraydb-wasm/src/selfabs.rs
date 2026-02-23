use wasm_bindgen::prelude::*;

use crate::types::{AmeyanagiResult, AtomsResult, BoothResult, FluoParamsResult, TrogerResult};

fn make_geometry(
    theta_in: Option<f64>,
    theta_out: Option<f64>,
) -> Option<selfabs::FluorescenceGeometry> {
    match (theta_in, theta_out) {
        (Some(ti), Some(tf)) => Some(selfabs::FluorescenceGeometry {
            theta_incident_deg: ti,
            theta_fluorescence_deg: tf,
        }),
        _ => None,
    }
}

/// Fluo algorithm (Haskel, Ravel, Stern).
/// Computes parameters for correcting normalized μ(E). Applicable to XANES.
#[wasm_bindgen]
pub fn sa_fluo(
    formula: &str,
    central_element: &str,
    edge: &str,
    energies: &[f64],
    theta_incident: Option<f64>,
    theta_fluorescence: Option<f64>,
) -> Result<FluoParamsResult, JsError> {
    let geo = make_geometry(theta_incident, theta_fluorescence);
    let r = selfabs::fluo::fluo_params(formula, central_element, edge, energies, geo)
        .map_err(|e| JsError::new(&e.to_string()))?;

    Ok(FluoParamsResult {
        beta: r.beta,
        gamma_prime: r.gamma_prime,
        ratio: r.ratio,
        mu_background_norm: r.mu_background_norm,
        edge_energy: r.edge_energy,
        fluorescence_energy: r.fluorescence_energy,
    })
}

/// Tröger algorithm (Tröger et al., PRB 46:6, 1992).
/// Simple χ(k) correction for thick samples: χ_corr = χ / (1 − s).
#[wasm_bindgen]
pub fn sa_troger(
    formula: &str,
    central_element: &str,
    edge: &str,
    energies: &[f64],
    theta_incident: Option<f64>,
    theta_fluorescence: Option<f64>,
) -> Result<TrogerResult, JsError> {
    let geo = make_geometry(theta_incident, theta_fluorescence);
    let r = selfabs::troger::troger(formula, central_element, edge, energies, geo)
        .map_err(|e| JsError::new(&e.to_string()))?;

    Ok(TrogerResult {
        energies: r.energies,
        k: r.k,
        s: r.s,
        correction_factor: r.correction_factor,
        edge_energy: r.edge_energy,
        fluorescence_energy: r.fluorescence_energy,
    })
}

/// Booth algorithm (Booth & Bridges, Phys. Scr. T115, 2005).
/// Handles thin and thick samples. Includes nonlinear χ+1 term.
#[wasm_bindgen]
pub fn sa_booth(
    formula: &str,
    central_element: &str,
    edge: &str,
    energies: &[f64],
    theta_incident: Option<f64>,
    theta_fluorescence: Option<f64>,
    thickness_um: f64,
) -> Result<BoothResult, JsError> {
    let geo = make_geometry(theta_incident, theta_fluorescence);
    let r = selfabs::booth::booth(formula, central_element, edge, energies, geo, thickness_um)
        .map_err(|e| JsError::new(&e.to_string()))?;

    Ok(BoothResult {
        energies: r.energies,
        k: r.k,
        is_thick: r.is_thick,
        s: r.s,
        alpha: r.alpha,
        sin_phi: r.sin_phi,
        edge_energy: r.edge_energy,
        fluorescence_energy: r.fluorescence_energy,
    })
}

/// Ameyanagi algorithm.
/// Computes exact suppression factor R(E, χ) from the full Booth expression.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn sa_ameyanagi(
    formula: &str,
    central_element: &str,
    edge: &str,
    energies: &[f64],
    density_g_cm3: f64,
    phi_rad: f64,
    theta_rad: f64,
    thickness_cm: Option<f64>,
    pellet_mass_g: Option<f64>,
    pellet_diameter_cm: Option<f64>,
    chi_assumed: f64,
) -> Result<AmeyanagiResult, JsError> {
    let thickness_input = match (thickness_cm, pellet_mass_g, pellet_diameter_cm) {
        (Some(d), _, _) => selfabs::ameyanagi::AmeyanagiThicknessInput::ThicknessCm(d),
        (None, Some(m), Some(d)) => {
            selfabs::ameyanagi::AmeyanagiThicknessInput::PelletMassDiameter {
                mass_g: m,
                diameter_cm: d,
            }
        }
        _ => {
            return Err(JsError::new(
                "provide thickness_cm, or both pellet_mass_g and pellet_diameter_cm",
            ));
        }
    };

    let r = selfabs::ameyanagi::ameyanagi_suppression_exact(
        formula,
        central_element,
        edge,
        energies,
        selfabs::ameyanagi::AmeyanagiSuppressionSettings {
            density_g_cm3,
            phi_rad,
            theta_rad,
            thickness_input,
            chi_assumed,
        },
    )
    .map_err(|e| JsError::new(&e.to_string()))?;

    Ok(AmeyanagiResult {
        energies: r.energies,
        suppression_factor: r.suppression_factor,
        r_min: r.r_min,
        r_max: r.r_max,
        r_mean: r.r_mean,
        mu_f: r.mu_f,
        thickness_cm: r.thickness_cm,
        geometry_g: r.geometry_g,
        beta: r.beta,
        edge_energy: r.edge_energy,
        fluorescence_energy_weighted: r.fluorescence_energy_weighted,
    })
}

/// Atoms algorithm (Ravel, J. Synch. Rad. 8:2, 2001).
/// Simplest: amplitude + σ² correction. No geometry needed.
#[wasm_bindgen]
pub fn sa_atoms(
    formula: &str,
    central_element: &str,
    edge: &str,
    energies: &[f64],
) -> Result<AtomsResult, JsError> {
    let r = selfabs::atoms::atoms(formula, central_element, edge, energies)
        .map_err(|e| JsError::new(&e.to_string()))?;

    Ok(AtomsResult {
        energies: r.energies,
        k: r.k,
        correction: r.correction,
        amplitude: r.amplitude,
        sigma_squared_self: r.sigma_squared_self,
        sigma_squared_norm: r.sigma_squared_norm,
        sigma_squared_i0: r.sigma_squared_i0,
        sigma_squared_net: r.sigma_squared_net,
        edge_energy: r.edge_energy,
        fluorescence_energy: r.fluorescence_energy,
    })
}
