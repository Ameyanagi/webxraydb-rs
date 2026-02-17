/**
 * Typed wrappers around WASM functions.
 * Import these functions instead of calling wasm-bindgen exports directly.
 */
export {
  // Element lookups
  element_info,
  all_elements,
  atomic_number,
  symbol,
  atomic_name,
  molar_mass,
  element_density,
  // Edges & lines
  xray_edges,
  xray_edge_energy,
  fluorescence_yield,
  jump_ratio,
  xray_lines,
  guess_edge,
  corehole_widths,
  // Attenuation
  material_mu,
  material_mu_named,
  mu_elam,
  xray_delta_beta,
  find_material,
  list_materials,
  // Scattering
  f0,
  f1_chantler,
  f2_chantler,
  mu_chantler,
  // Ion chamber
  ionchamber_fluxes,
  ionization_potential,
  compton_energies,
  // Optics
  darwin_width,
  mirror_reflectivity,
  // Formula
  parse_formula,
  validate_formula,
} from "~/wasm-pkg/webxraydb_wasm";
