use wasm_bindgen::prelude::*;
use xraydb::XrayDb;

use crate::types::ElementInfo;

fn db() -> XrayDb {
    XrayDb::new()
}

fn to_js(e: xraydb::XrayDbError) -> JsError {
    JsError::new(&e.to_string())
}

#[wasm_bindgen]
pub fn element_info(element: &str) -> Result<ElementInfo, JsError> {
    let db = db();
    let z = db.atomic_number(element).map_err(to_js)?;
    let symbol = db.symbol(element).map_err(to_js)?.to_string();
    let name = db.atomic_name(element).map_err(to_js)?.to_string();
    let molar_mass = db.molar_mass(element).map_err(to_js)?;
    let density = db.density(element).map_err(to_js)?;

    Ok(ElementInfo {
        z,
        symbol,
        name,
        molar_mass,
        density,
    })
}

#[wasm_bindgen]
pub fn all_elements() -> Vec<ElementInfo> {
    let db = db();
    let raw = db.raw();
    raw.elements
        .iter()
        .map(|elem| ElementInfo {
            z: elem.atomic_number,
            symbol: elem.symbol.clone(),
            name: elem.name.clone(),
            molar_mass: elem.molar_mass,
            density: elem.density,
        })
        .collect()
}

#[wasm_bindgen]
pub fn atomic_number(element: &str) -> Result<u16, JsError> {
    db().atomic_number(element).map_err(to_js)
}

#[wasm_bindgen]
pub fn symbol(element: &str) -> Result<String, JsError> {
    db().symbol(element).map(|s| s.to_string()).map_err(to_js)
}

#[wasm_bindgen]
pub fn atomic_name(element: &str) -> Result<String, JsError> {
    db().atomic_name(element)
        .map(|s| s.to_string())
        .map_err(to_js)
}

#[wasm_bindgen]
pub fn molar_mass(element: &str) -> Result<f64, JsError> {
    db().molar_mass(element).map_err(to_js)
}

#[wasm_bindgen]
pub fn element_density(element: &str) -> Result<f64, JsError> {
    db().density(element).map_err(to_js)
}
