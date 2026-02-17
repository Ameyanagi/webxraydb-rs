use wasm_bindgen::prelude::*;
use xraydb::XrayDb;

use crate::types::{CoreholeWidthInfo, EdgeGuess, XrayEdgeInfo, XrayLineInfo};

fn db() -> XrayDb {
    XrayDb::new()
}

fn to_js(e: xraydb::XrayDbError) -> JsError {
    JsError::new(&e.to_string())
}

#[wasm_bindgen]
pub fn xray_edges(element: &str) -> Result<Vec<XrayEdgeInfo>, JsError> {
    let edges = db().xray_edges(element).map_err(to_js)?;
    let mut result: Vec<XrayEdgeInfo> = edges
        .into_iter()
        .map(|(label, edge)| XrayEdgeInfo {
            label,
            energy: edge.energy,
            fluorescence_yield: edge.fluorescence_yield,
            jump_ratio: edge.jump_ratio,
        })
        .collect();
    result.sort_by(|a, b| a.energy.partial_cmp(&b.energy).unwrap().reverse());
    Ok(result)
}

#[wasm_bindgen]
pub fn xray_edge_energy(element: &str, edge: &str) -> Result<f64, JsError> {
    db().xray_edge(element, edge)
        .map(|e| e.energy)
        .map_err(to_js)
}

#[wasm_bindgen]
pub fn fluorescence_yield(element: &str, edge: &str) -> Result<f64, JsError> {
    db().xray_edge(element, edge)
        .map(|e| e.fluorescence_yield)
        .map_err(to_js)
}

#[wasm_bindgen]
pub fn jump_ratio(element: &str, edge: &str) -> Result<f64, JsError> {
    db().xray_edge(element, edge)
        .map(|e| e.jump_ratio)
        .map_err(to_js)
}

#[wasm_bindgen]
pub fn xray_lines(
    element: &str,
    initial_level: Option<String>,
    excitation_energy: Option<f64>,
) -> Result<Vec<XrayLineInfo>, JsError> {
    let lines = db()
        .xray_lines(element, initial_level.as_deref(), excitation_energy)
        .map_err(to_js)?;
    let mut result: Vec<XrayLineInfo> = lines
        .into_iter()
        .map(|(label, line)| XrayLineInfo {
            label,
            energy: line.energy,
            intensity: line.intensity,
            initial_level: line.initial_level,
            final_level: line.final_level,
        })
        .collect();
    result.sort_by(|a, b| b.intensity.partial_cmp(&a.intensity).unwrap());
    Ok(result)
}

#[wasm_bindgen]
pub fn guess_edge(energy: f64) -> Option<EdgeGuess> {
    db().guess_edge(energy, None)
        .map(|(element, edge)| EdgeGuess { element, edge })
}

#[wasm_bindgen]
pub fn corehole_widths(element: &str) -> Result<Vec<CoreholeWidthInfo>, JsError> {
    let widths = db().core_width(element, None).map_err(to_js)?;
    let mut result: Vec<CoreholeWidthInfo> = widths
        .into_iter()
        .map(|(edge, width)| CoreholeWidthInfo { edge, width })
        .collect();
    result.sort_by(|a, b| a.edge.cmp(&b.edge));
    Ok(result)
}
