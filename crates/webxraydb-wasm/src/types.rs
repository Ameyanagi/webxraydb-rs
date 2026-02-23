use serde::Serialize;
use tsify_next::Tsify;

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct ElementInfo {
    pub z: u16,
    pub symbol: String,
    pub name: String,
    pub molar_mass: f64,
    pub density: f64,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct XrayEdgeInfo {
    pub label: String,
    pub energy: f64,
    pub fluorescence_yield: f64,
    pub jump_ratio: f64,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct XrayLineInfo {
    pub label: String,
    pub energy: f64,
    pub intensity: f64,
    pub initial_level: String,
    pub final_level: String,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct EdgeGuess {
    pub element: String,
    pub edge: String,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct CoreholeWidthInfo {
    pub edge: String,
    pub width: f64,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct MaterialInfo {
    pub name: String,
    pub formula: String,
    pub density: f64,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct DeltaBetaResult {
    pub delta: f64,
    pub beta: f64,
    pub attenuation_length_cm: f64,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct IonChamberResult {
    pub incident: f64,
    pub transmitted: f64,
    pub photo: f64,
    pub incoherent: f64,
    pub coherent: f64,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct ComptonResult {
    pub xray_90deg: f64,
    pub xray_mean: f64,
    pub electron_mean: f64,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct DarwinWidthResult {
    pub theta: f64,
    pub theta_offset: f64,
    pub theta_width: f64,
    pub theta_fwhm: f64,
    pub rocking_theta_fwhm: f64,
    pub energy_width: f64,
    pub energy_fwhm: f64,
    pub rocking_energy_fwhm: f64,
    pub zeta: Vec<f64>,
    pub dtheta: Vec<f64>,
    pub denergy: Vec<f64>,
    pub intensity: Vec<f64>,
    pub rocking_curve: Vec<f64>,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct FormulaComponent {
    pub symbol: String,
    pub count: f64,
}

#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct ParsedFormula {
    pub components: Vec<FormulaComponent>,
}

#[derive(serde::Deserialize, Tsify)]
#[tsify(from_wasm_abi)]
pub struct GasMixture {
    pub name: String,
    pub fraction: f64,
}

/// Fluo algorithm result (operates on μ(E)).
#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct FluoParamsResult {
    pub beta: f64,
    pub gamma_prime: f64,
    pub ratio: f64,
    pub mu_background_norm: Vec<f64>,
    pub edge_energy: f64,
    pub fluorescence_energy: f64,
}

/// Tröger algorithm result (χ(k) correction).
#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct TrogerResult {
    pub energies: Vec<f64>,
    pub k: Vec<f64>,
    pub s: Vec<f64>,
    pub correction_factor: Vec<f64>,
    pub edge_energy: f64,
    pub fluorescence_energy: f64,
}

/// Booth algorithm result (χ(k) correction, thin + thick).
#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct BoothResult {
    pub energies: Vec<f64>,
    pub k: Vec<f64>,
    pub is_thick: bool,
    pub s: Vec<f64>,
    pub alpha: Vec<f64>,
    pub edge_energy: f64,
    pub fluorescence_energy: f64,
}

/// Atoms algorithm result (amplitude + σ² correction).
#[derive(Serialize, Tsify)]
#[tsify(into_wasm_abi)]
pub struct AtomsResult {
    pub energies: Vec<f64>,
    pub k: Vec<f64>,
    pub correction: Vec<f64>,
    pub amplitude: f64,
    pub sigma_squared_self: f64,
    pub sigma_squared_norm: f64,
    pub sigma_squared_i0: f64,
    pub sigma_squared_net: f64,
    pub edge_energy: f64,
    pub fluorescence_energy: f64,
}
