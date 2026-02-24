//! Shared types and utilities for self-absorption algorithms.

use std::collections::HashMap;
use std::fmt;

use chemical_formula::prelude::parse_formula;
use xraydb::{CrossSectionKind, XrayDb};

/// Energy-to-k conversion: k (Å⁻¹) = sqrt(ETOK × (E - E₀) [eV]).
pub const ETOK: f64 = 0.2624682917;

/// Measurement geometry for fluorescence XAS.
///
/// Default is 45° incident / 45° exit (geometry ratio = 1.0).
pub struct FluorescenceGeometry {
    pub theta_incident_deg: f64,
    pub theta_fluorescence_deg: f64,
}

impl FluorescenceGeometry {
    /// sin(θ_in) / sin(θ_out).
    pub fn ratio(&self) -> f64 {
        self.theta_incident_deg.to_radians().sin() / self.theta_fluorescence_deg.to_radians().sin()
    }
}

impl Default for FluorescenceGeometry {
    fn default() -> Self {
        Self {
            theta_incident_deg: 45.0,
            theta_fluorescence_deg: 45.0,
        }
    }
}

#[derive(Debug)]
pub enum SelfAbsError {
    Xraydb(xraydb::XrayDbError),
    NoEmissionLines(String),
    InvalidFormula(String),
    InsufficientData(String),
}

impl fmt::Display for SelfAbsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Xraydb(e) => write!(f, "xraydb error: {e}"),
            Self::NoEmissionLines(s) => write!(f, "no emission lines found for {s}"),
            Self::InvalidFormula(s) => write!(f, "invalid formula: {s}"),
            Self::InsufficientData(s) => write!(f, "insufficient data: {s}"),
        }
    }
}

impl std::error::Error for SelfAbsError {}

impl From<xraydb::XrayDbError> for SelfAbsError {
    fn from(e: xraydb::XrayDbError) -> Self {
        Self::Xraydb(e)
    }
}

/// Precomputed sample information shared across algorithms.
pub(crate) struct SampleInfo {
    pub composition: HashMap<String, f64>,
    pub central_symbol: String,
    pub central_z: u16,
    pub central_count: f64,
    pub edge_energy: f64,
    pub fluor_energy: f64,
}

impl SampleInfo {
    pub fn new(
        db: &XrayDb,
        formula: &str,
        central_element: &str,
        edge: &str,
    ) -> Result<Self, SelfAbsError> {
        let parsed =
            parse_formula(formula).map_err(|e| SelfAbsError::InvalidFormula(e.to_string()))?;
        let molecular = parsed
            .to_molecular_formula()
            .map_err(|e| SelfAbsError::InvalidFormula(e.to_string()))?;
        let composition: HashMap<String, f64> = molecular
            .stoichiometry
            .iter()
            .map(|(sym, &count)| (format!("{sym:?}"), count))
            .collect();

        let central_z = db.resolve_element(central_element)?;
        let central_symbol = db.symbol(&central_z.to_string())?.to_string();

        let central_count = find_element_count(&composition, db, central_z).ok_or_else(|| {
            SelfAbsError::InvalidFormula(format!(
                "{central_element} not found in formula {formula}"
            ))
        })?;

        let edge_energy = db.xray_edge(central_element, edge)?.energy;

        let lines = db.xray_lines(central_element, Some(edge), None)?;
        let fluor_energy = lines
            .values()
            .max_by(|a, b| {
                a.intensity
                    .partial_cmp(&b.intensity)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .map(|l| l.energy)
            .ok_or_else(|| SelfAbsError::NoEmissionLines(format!("{central_element} {edge}")))?;

        Ok(Self {
            composition,
            central_symbol,
            central_z,
            central_count,
            edge_energy,
            fluor_energy,
        })
    }
}

fn find_element_count(
    composition: &HashMap<String, f64>,
    db: &XrayDb,
    target_z: u16,
) -> Option<f64> {
    for (sym, &count) in composition {
        if let Ok(z) = db.resolve_element(sym)
            && z == target_z
        {
            return Some(count);
        }
    }
    None
}

/// Compute stoichiometry-weighted mu at given energies for all atoms.
///
/// Returns Σ(count_i × μ_elam_i(E)) in cm²/g-equivalent units.
/// (For ratios between similar quantities the units cancel.)
pub(crate) fn weighted_mu_total(
    db: &XrayDb,
    composition: &HashMap<String, f64>,
    energies: &[f64],
) -> Result<Vec<f64>, SelfAbsError> {
    let n = energies.len();
    let mut total = vec![0.0f64; n];
    for (sym, &count) in composition {
        let mu = db.mu_elam(sym, energies, CrossSectionKind::Photo)?;
        for (i, &m) in mu.iter().enumerate() {
            total[i] += count * m;
        }
    }
    Ok(total)
}

/// Convert formula stoichiometry to mass fractions for each element.
pub(crate) fn composition_mass_fractions(
    db: &XrayDb,
    composition: &HashMap<String, f64>,
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

/// Compute compound linear attenuation μ(E) in cm^-1 from mass fractions.
pub(crate) fn compound_mu_linear(
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

/// Compute compound linear attenuation μ(E) at one energy in cm^-1.
pub(crate) fn compound_mu_linear_single(
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

/// Compute absorber edge contribution μ̄_a(E) in cm^-1 using a pre-edge trendline.
///
/// Definition:
/// `μ̄_a(E) = max(μ_abs_raw(E) - μ_pretrend(E), 0)`
///
/// with:
/// `μ_abs_raw(E) = ρ * w_a * (μ/ρ)_absorber(E)`.
///
/// The pre-edge trendline is fit over `[E0 - 200 eV, E0 - 30 eV]`.
/// If fitting is unstable or there are insufficient points, a scalar baseline
/// at `E0 - 200 eV` is used.
pub(crate) fn absorber_edge_mu_linear_trendline(
    db: &XrayDb,
    info: &SampleInfo,
    energies_ev: &[f64],
    density_g_cm3: f64,
) -> Result<Vec<f64>, SelfAbsError> {
    if !density_g_cm3.is_finite() || density_g_cm3 <= 0.0 {
        return Err(SelfAbsError::InsufficientData(
            "density must be finite and > 0".to_string(),
        ));
    }
    if energies_ev.is_empty() {
        return Err(SelfAbsError::InsufficientData(
            "energy grid must not be empty".to_string(),
        ));
    }

    let mass_fractions = composition_mass_fractions(db, &info.composition)?;
    let w_absorber = mass_fractions
        .iter()
        .find_map(|(sym, w)| (sym == &info.central_symbol).then_some(*w))
        .ok_or_else(|| {
            SelfAbsError::InsufficientData(format!(
                "absorber {} not found in mass fractions",
                info.central_symbol
            ))
        })?;

    let mu_abs_mass = db.mu_elam(&info.central_symbol, energies_ev, CrossSectionKind::Photo)?;
    let mu_abs_raw: Vec<f64> = mu_abs_mass
        .iter()
        .map(|&mu_rho| density_g_cm3 * w_absorber * mu_rho)
        .collect();

    const PRE_EDGE_START_REL_EV: f64 = -200.0;
    const PRE_EDGE_END_REL_EV: f64 = -30.0;
    const PRE_EDGE_FALLBACK_REL_EV: f64 = -200.0;
    const N_VICTOREEN: i32 = 0;

    let pre_start = info.edge_energy + PRE_EDGE_START_REL_EV;
    let pre_end = info.edge_energy + PRE_EDGE_END_REL_EV;
    let (fit_min, fit_max) = if pre_start <= pre_end {
        (pre_start, pre_end)
    } else {
        (pre_end, pre_start)
    };

    let mut fit_x = Vec::new();
    let mut fit_y = Vec::new();
    for (&e, &mu_raw) in energies_ev.iter().zip(mu_abs_raw.iter()) {
        if e >= fit_min && e <= fit_max && e.is_finite() && mu_raw.is_finite() {
            let y = mu_raw * e.powi(N_VICTOREEN);
            if y.is_finite() {
                fit_x.push(e);
                fit_y.push(y);
            }
        }
    }

    let baseline: Vec<f64> = if let Some((intercept, slope)) = fit_line(&fit_x, &fit_y) {
        energies_ev
            .iter()
            .map(|&e| {
                let y = (intercept + slope * e) * e.powi(-N_VICTOREEN);
                if y.is_finite() { y.max(0.0) } else { 0.0 }
            })
            .collect()
    } else {
        let e_pre = info.edge_energy + PRE_EDGE_FALLBACK_REL_EV;
        let mu_pre_mass = db.mu_elam(&info.central_symbol, &[e_pre], CrossSectionKind::Photo)?[0];
        let mu_pre = (density_g_cm3 * w_absorber * mu_pre_mass).max(0.0);
        vec![mu_pre; energies_ev.len()]
    };

    Ok(mu_abs_raw
        .iter()
        .zip(baseline.iter())
        .map(|(&raw, &base)| (raw - base).max(0.0))
        .collect())
}

/// Compute stoichiometry-weighted mu for the absorber only.
///
/// `subtract_pre_edge`: if true, subtracts μ(E_edge − 200 eV) to get the
/// edge-jump contribution only (used by Troger, Booth, Atoms).
pub(crate) fn weighted_mu_absorber(
    db: &XrayDb,
    info: &SampleInfo,
    energies: &[f64],
    subtract_pre_edge: bool,
) -> Result<Vec<f64>, SelfAbsError> {
    let mu = db.mu_elam(&info.central_symbol, energies, CrossSectionKind::Photo)?;

    let pre_edge = if subtract_pre_edge {
        let e_below = info.edge_energy - 200.0;
        let v = db.mu_elam(&info.central_symbol, &[e_below], CrossSectionKind::Photo)?;
        v[0]
    } else {
        0.0
    };

    Ok(mu
        .iter()
        .map(|&m| info.central_count * (m - pre_edge).max(0.0))
        .collect())
}

/// Compute stoichiometry-weighted mu for all non-absorber atoms.
pub(crate) fn weighted_mu_background(
    db: &XrayDb,
    info: &SampleInfo,
    energies: &[f64],
) -> Result<Vec<f64>, SelfAbsError> {
    let n = energies.len();
    let mut total = vec![0.0f64; n];
    for (sym, &count) in &info.composition {
        let z = db.resolve_element(sym)?;
        if z == info.central_z {
            continue;
        }
        let mu = db.mu_elam(sym, energies, CrossSectionKind::Photo)?;
        for (i, &m) in mu.iter().enumerate() {
            total[i] += count * m;
        }
    }
    Ok(total)
}

/// Compute stoichiometry-weighted mu at a single energy for all atoms.
pub(crate) fn weighted_mu_total_single(
    db: &XrayDb,
    composition: &HashMap<String, f64>,
    energy: f64,
) -> Result<f64, SelfAbsError> {
    let mut total = 0.0;
    for (sym, &count) in composition {
        let mu = db.mu_elam(sym, &[energy], CrossSectionKind::Photo)?;
        total += count * mu[0];
    }
    Ok(total)
}

/// Linear least-squares fit of ln(y) vs x for points where x > 0 and y > 0.
///
/// Model: ln(y) = intercept + slope × x.
/// Returns (intercept, slope). If insufficient data, returns (0, 0).
pub(crate) fn fit_ln_vs_x(x: &[f64], y: &[f64]) -> (f64, f64) {
    let mut sx = 0.0;
    let mut sy = 0.0;
    let mut sxx = 0.0;
    let mut sxy = 0.0;
    let mut n = 0u32;

    for (&xi, &yi) in x.iter().zip(y.iter()) {
        if xi <= 0.0 || yi <= 0.0 {
            continue;
        }
        let ly = yi.ln();
        sx += xi;
        sy += ly;
        sxx += xi * xi;
        sxy += xi * ly;
        n += 1;
    }

    if n < 2 {
        return (0.0, 0.0);
    }

    let nf = n as f64;
    let denom = nf * sxx - sx * sx;
    if denom.abs() < 1e-30 {
        return (0.0, 0.0);
    }

    let slope = (nf * sxy - sx * sy) / denom;
    let intercept = (sy - slope * sx) / nf;
    (intercept, slope)
}

fn fit_line(x: &[f64], y: &[f64]) -> Option<(f64, f64)> {
    if x.len() != y.len() || x.len() < 2 {
        return None;
    }

    let mut sx = 0.0;
    let mut sy = 0.0;
    let mut sxx = 0.0;
    let mut sxy = 0.0;
    let mut n = 0u32;

    for (&xi, &yi) in x.iter().zip(y.iter()) {
        if !xi.is_finite() || !yi.is_finite() {
            continue;
        }
        sx += xi;
        sy += yi;
        sxx += xi * xi;
        sxy += xi * yi;
        n += 1;
    }

    if n < 2 {
        return None;
    }

    let nf = n as f64;
    let denom = nf * sxx - sx * sx;
    if !denom.is_finite() || denom.abs() < 1e-30 {
        return None;
    }

    let slope = (nf * sxy - sx * sy) / denom;
    let intercept = (sy - slope * sx) / nf;
    if !slope.is_finite() || !intercept.is_finite() {
        return None;
    }
    Some((intercept, slope))
}

/// Convert energy array to k array. k = 0 for E ≤ E_edge.
pub(crate) fn energies_to_k(energies: &[f64], e_edge: f64) -> Vec<f64> {
    energies
        .iter()
        .map(|&e| {
            if e > e_edge {
                ((e - e_edge) * ETOK).sqrt()
            } else {
                0.0
            }
        })
        .collect()
}
