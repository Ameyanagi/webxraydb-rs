use wasm_bindgen::prelude::*;
use xraydb::XrayDb;

use crate::types::{ComptonResult, GasMixture, IonChamberResult};

fn db() -> XrayDb {
    XrayDb::new()
}

fn to_js(e: xraydb::XrayDbError) -> JsError {
    JsError::new(&e.to_string())
}

/// Calculate ion chamber fluxes from measured voltage.
#[wasm_bindgen]
pub fn ionchamber_fluxes(
    gases: Vec<GasMixture>,
    volts: f64,
    length_cm: f64,
    energy: f64,
    sensitivity: f64,
    with_compton: bool,
    both_carriers: bool,
) -> Result<IonChamberResult, JsError> {
    let gas_pairs: Vec<(&str, f64)> = gases
        .iter()
        .map(|g| (g.name.as_str(), g.fraction))
        .collect();

    let result = db()
        .ionchamber_fluxes(
            &gas_pairs,
            volts,
            length_cm,
            energy,
            sensitivity,
            with_compton,
            both_carriers,
        )
        .map_err(to_js)?;

    Ok(IonChamberResult {
        incident: result.incident,
        transmitted: result.transmitted,
        photo: result.photo,
        incoherent: result.incoherent,
        coherent: result.coherent,
    })
}

/// Returns ionization potential (eV per ion pair) for a gas.
#[wasm_bindgen]
pub fn ionization_potential(gas: &str) -> Result<f64, JsError> {
    db().ionization_potential(gas).map_err(to_js)
}

/// Returns Compton energies for a given incident energy.
#[wasm_bindgen]
pub fn compton_energies(incident_energy: f64) -> ComptonResult {
    let c = db().compton_energies(incident_energy);
    ComptonResult {
        xray_90deg: c.xray_90deg,
        xray_mean: c.xray_mean,
        electron_mean: c.electron_mean,
    }
}
