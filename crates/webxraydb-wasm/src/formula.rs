use wasm_bindgen::prelude::*;

use crate::types::{FormulaComponent, ParsedFormula};

/// Parse a chemical formula and return its components.
/// Supports complex formulas like "Pt5wt%/SiO2" via the chemical-formula crate.
#[wasm_bindgen]
pub fn parse_formula(input: &str) -> Result<ParsedFormula, JsError> {
    let parsed = chemical_formula::prelude::parse_formula(input)
        .map_err(|e| JsError::new(&format!("invalid formula: {e}")))?;

    // Convert to molecular formula to get stoichiometry
    let molecular = parsed
        .to_molecular_formula()
        .map_err(|e| JsError::new(&format!("cannot convert formula: {e}")))?;

    let components: Vec<FormulaComponent> = molecular
        .stoichiometry
        .iter()
        .map(|(symbol, &count)| FormulaComponent {
            symbol: format!("{symbol:?}"),
            count,
        })
        .collect();

    Ok(ParsedFormula { components })
}

/// Validate a chemical formula. Returns true if the formula is valid.
#[wasm_bindgen]
pub fn validate_formula(input: &str) -> bool {
    chemical_formula::prelude::parse_formula(input).is_ok()
}
