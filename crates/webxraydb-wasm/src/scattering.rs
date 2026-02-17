use wasm_bindgen::prelude::*;
use xraydb::{ChantlerKind, XrayDb};

fn db() -> XrayDb {
    XrayDb::new()
}

fn to_js(e: xraydb::XrayDbError) -> JsError {
    JsError::new(&e.to_string())
}

/// Returns f0 elastic scattering factor at given q values (Å⁻¹).
#[wasm_bindgen]
pub fn f0(ion: &str, q: &[f64]) -> Result<Vec<f64>, JsError> {
    db().f0(ion, q).map_err(to_js)
}

/// Returns f1 (anomalous scattering factor, real part) from Chantler tables.
#[wasm_bindgen]
pub fn f1_chantler(element: &str, energies: &[f64]) -> Result<Vec<f64>, JsError> {
    db().f1_chantler(element, energies).map_err(to_js)
}

/// Returns f2 (anomalous scattering factor, imaginary part) from Chantler tables.
#[wasm_bindgen]
pub fn f2_chantler(element: &str, energies: &[f64]) -> Result<Vec<f64>, JsError> {
    db().f2_chantler(element, energies).map_err(to_js)
}

/// Returns Chantler mass attenuation coefficient (cm²/g).
#[wasm_bindgen]
pub fn mu_chantler(element: &str, energies: &[f64], kind: &str) -> Result<Vec<f64>, JsError> {
    let k = match kind.to_lowercase().as_str() {
        "total" => ChantlerKind::Total,
        "photo" => ChantlerKind::Photo,
        "incoherent" | "incoh" => ChantlerKind::Incoherent,
        _ => return Err(JsError::new(&format!("unknown Chantler kind: {kind}"))),
    };
    db().mu_chantler(element, energies, k).map_err(to_js)
}
