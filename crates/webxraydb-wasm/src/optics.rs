use wasm_bindgen::prelude::*;
use xraydb::{Polarization, XrayDb};

use crate::types::DarwinWidthResult;

fn db() -> XrayDb {
    XrayDb::new()
}

fn to_js(e: xraydb::XrayDbError) -> JsError {
    JsError::new(&e.to_string())
}

fn parse_polarization(pol: &str) -> Result<Polarization, JsError> {
    match pol.to_lowercase().as_str() {
        "s" | "sigma" => Ok(Polarization::S),
        "p" | "pi" => Ok(Polarization::P),
        "unpolarized" | "u" => Ok(Polarization::Unpolarized),
        _ => Err(JsError::new(&format!("unknown polarization: {pol}"))),
    }
}

/// Calculate Darwin width for a crystal reflection.
/// Returns null if Bragg condition cannot be satisfied.
#[wasm_bindgen]
pub fn darwin_width(
    energy: f64,
    crystal: &str,
    h: i32,
    k: i32,
    l: i32,
    polarization: &str,
) -> Result<Option<DarwinWidthResult>, JsError> {
    let pol = parse_polarization(polarization)?;
    let result = db()
        .darwin_width(energy, crystal, (h, k, l), None, pol, false, false, 1)
        .map_err(to_js)?;

    Ok(result.map(|dw| DarwinWidthResult {
        theta: dw.theta,
        theta_offset: dw.theta_offset,
        theta_width: dw.theta_width,
        theta_fwhm: dw.theta_fwhm,
        rocking_theta_fwhm: dw.rocking_theta_fwhm,
        energy_width: dw.energy_width,
        energy_fwhm: dw.energy_fwhm,
        rocking_energy_fwhm: dw.rocking_energy_fwhm,
        zeta: dw.zeta,
        dtheta: dw.dtheta,
        denergy: dw.denergy,
        intensity: dw.intensity,
        rocking_curve: dw.rocking_curve,
    }))
}

/// Mirror reflectivity for a thick, single-layer mirror.
#[wasm_bindgen]
pub fn mirror_reflectivity(
    formula: &str,
    thetas: &[f64],
    energy: f64,
    density: f64,
    roughness: f64,
    polarization: &str,
) -> Result<Vec<f64>, JsError> {
    let pol = parse_polarization(polarization)?;
    db().mirror_reflectivity(formula, thetas, energy, density, roughness, pol)
        .map_err(to_js)
}
