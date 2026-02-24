import type { ToolDoc, ToolDocId, ToolReference } from "~/docs/types";

const REF_ELAM: ToolReference = {
  citation:
    "Elam WT, Ravel BD, Sieber JR. A new atomic database for X-ray spectroscopic calculations. Radiation Physics and Chemistry 63 (2002) 121-128.",
  doi: "10.1016/S0969-806X(01)00227-4",
};

const REF_CHANTLER: ToolReference = {
  citation:
    "Chantler CT. Theoretical Form Factor, Attenuation, and Scattering Tabulation for Z=1-92 from E=1-10 eV to E=0.4-1.0 MeV. Journal of Physical and Chemical Reference Data 24 (1995) 71-643.",
  doi: "10.1063/1.555974",
};

const REF_NIST_ATTEN: ToolReference = {
  citation:
    "Hubbell JH, Seltzer SM. Tables of X-Ray Mass Attenuation Coefficients and Mass Energy-Absorption Coefficients.",
  url: "https://www.nist.gov/pml/xray-mass-attenuation-coefficients",
};

const REF_BRAGG: ToolReference = {
  citation:
    "Bragg WL. The diffraction of short electromagnetic waves by a crystal. Proc. Cambridge Philos. Soc. 17 (1913) 43-57.",
  url: "https://www.cambridge.org/core/journals/proceedings-of-the-cambridge-philosophical-society",
};

const REF_PARRATT: ToolReference = {
  citation:
    "Parratt LG. Surface studies of solids by total reflection of X-rays. Physical Review 95 (1954) 359-369.",
  doi: "10.1103/PhysRev.95.359",
};

const REF_TROGER: ToolReference = {
  citation:
    "Troger L, Arvanitis D, Baberschke K, Michaelis H, Grimm U, Zschech E. Full correction of the self-absorption in soft-fluorescence EXAFS. Physical Review B 46 (1992) 3283-3289.",
  doi: "10.1103/PhysRevB.46.3283",
};

const REF_BOOTH: ToolReference = {
  citation:
    "Booth CH, Bridges F. Improved self-absorption correction for fluorescence measurements of extended x-ray absorption fine-structure. Physica Scripta T115 (2005) 202-204.",
};

const REF_REHR: ToolReference = {
  citation:
    "Rehr JJ, Albers RC. Theoretical approaches to x-ray absorption fine structure. Reviews of Modern Physics 72 (2000) 621-654.",
  doi: "10.1103/RevModPhys.72.621",
};

const REF_XRAYDB: ToolReference = {
  citation: "xraydb project documentation and reference data overview.",
  url: "https://xraydb.xrayabsorption.org",
};

const REF_COMPTON: ToolReference = {
  citation: "Compton AH. A quantum theory of the scattering of X-rays by light elements. Physical Review 21 (1923) 483-502.",
  doi: "10.1103/PhysRev.21.483",
};

const REF_DYNAMICAL: ToolReference = {
  citation: "Authier A. Dynamical Theory of X-ray Diffraction. Oxford University Press (2001).",
};

const TOOL_DOCS: Record<ToolDocId, ToolDoc> = {
  "/": {
    id: "/",
    title: "Elements Overview",
    theorySummary: [
      "This page is an entry point into atomic X-ray properties. It links atomic identity, edge energies, emission lines, and attenuation/scattering lookups used by downstream tools.",
      "Energy-domain values are evaluated directly from tabulated databases in the WASM backend.",
    ],
    algorithmSteps: [
      "Resolve element metadata from atomic number/symbol.",
      "Load edge and line tables for selection and display.",
      "Use these values as seeds for detail-page plots and tool handoffs.",
    ],
    equations: [
      {
        label: "Energy-wavelength conversion",
        latex: String.raw`E = \frac{hc}{\lambda}`,
        variables: [
          { symbol: "E", description: "Photon energy", units: "eV" },
          { symbol: "\\lambda", description: "Wavelength", units: "A" },
        ],
      },
    ],
    references: [REF_XRAYDB, REF_CHANTLER, REF_ELAM],
    notes: [
      "Values shown are database values; no fitting is performed on this page.",
      "Units are eV for energies and g/cm^3 for elemental densities.",
    ],
  },
  "/element/$z": {
    id: "/element/$z",
    title: "Element Detail",
    theorySummary: [
      "Element detail combines edge/line tables with computed attenuation and scattering overlays for a single atomic number.",
      "Cross sections are evaluated per selected interaction channel (total, photoelectric, coherent, incoherent).",
    ],
    algorithmSteps: [
      "Generate an energy grid around available edges.",
      "Evaluate selected mu/rho channels from elemental tables.",
      "Overlay edge and line markers, plus optional Z-1 and Z-2 filter references.",
    ],
    equations: [
      {
        label: "Beer-Lambert transmission",
        latex: String.raw`T(E) = \exp\left[-\mu(E)\,t\right]`,
        variables: [
          { symbol: "\\mu", description: "Linear attenuation coefficient", units: "cm^{-1}" },
          { symbol: "t", description: "Path length", units: "cm" },
        ],
      },
      {
        label: "Mass-to-linear attenuation",
        latex: String.raw`\mu(E) = \rho\left(\frac{\mu}{\rho}\right)(E)`,
      },
    ],
    references: [REF_ELAM, REF_CHANTLER, REF_XRAYDB],
    notes: ["Overlay channels are lookup-based and do not include detector response effects."],
  },
  "/edges": {
    id: "/edges",
    title: "Edge Finder",
    theorySummary: [
      "Edge Finder performs nearest-neighbor matching between an input energy and tabulated absorption-edge energies.",
      "Harmonic mode evaluates E/2 and E/3 to support monochromator harmonic checks.",
    ],
    algorithmSteps: [
      "Build candidate edge list from all elements/edge labels.",
      "Compute absolute mismatch to query energy (or harmonic-adjusted energy).",
      "Sort by mismatch and return nearest matches.",
    ],
    equations: [
      {
        label: "Nearest-edge metric",
        latex: String.raw`\Delta E_i = \left|\frac{E_{\text{in}}}{n} - E_{\text{edge},i}\right|,\quad n\in\{1,2,3\}`,
      },
    ],
    references: [REF_XRAYDB, REF_ELAM],
    notes: ["The tool is a lookup/ranking utility and does not model spectral broadening."],
  },
  "/lines": {
    id: "/lines",
    title: "Line Finder",
    theorySummary: [
      "Line Finder matches an input energy to tabulated emission-line energies and reports nearest transitions.",
      "It is intended for fast identification of likely fluorescence or analyzer targets.",
    ],
    algorithmSteps: [
      "Aggregate available emission lines across elements.",
      "Compute absolute energy residual for each line.",
      "Sort and present best matches with transition labels.",
    ],
    equations: [
      {
        label: "Nearest-line metric",
        latex: String.raw`\Delta E_i = \left|E_{\text{in}} - E_{\text{line},i}\right|`,
      },
    ],
    references: [REF_XRAYDB, REF_ELAM],
    notes: ["Line intensities are tabulated relative values, not beamline-specific counts."],
  },
  "/attenuation": {
    id: "/attenuation",
    title: "X-ray Attenuation",
    theorySummary: [
      "This tool computes linear attenuation mu(E) for compounds/materials from tabulated mass attenuation coefficients and density.",
      "Users can inspect total and channel-specific contributions over energy.",
    ],
    algorithmSteps: [
      "Parse chemical formula and evaluate compound mass attenuation coefficient.",
      "Convert mass attenuation to linear attenuation with user density.",
      "Plot one or more materials over the selected energy grid.",
    ],
    equations: [
      {
        label: "Mass to linear attenuation",
        latex: String.raw`\mu(E)=\rho\left(\frac{\mu}{\rho}\right)(E)`,
      },
      {
        label: "Mixture by mass fractions",
        latex: String.raw`\left(\frac{\mu}{\rho}\right)_{\text{mix}}(E)=\sum_i w_i\left(\frac{\mu}{\rho}\right)_i(E),\quad \sum_i w_i=1`,
      },
    ],
    references: [REF_ELAM, REF_NIST_ATTEN, REF_XRAYDB],
    notes: ["All attenuation values are in 1/cm after density scaling."],
  },
  "/formulas": {
    id: "/formulas",
    title: "Absorption Formulas",
    theorySummary: [
      "This page derives practical quantities from attenuation data: absorption length, edge step, refractive terms, and elemental contributions.",
      "It provides quick engineering calculations for sample and optics planning.",
    ],
    algorithmSteps: [
      "Compute mu above and below target edge/energy.",
      "Convert to transmission and attenuation length metrics.",
      "Evaluate refractive index terms and per-element attenuation contributions.",
    ],
    equations: [
      {
        label: "Absorption length",
        latex: String.raw`\ell_{\text{att}}(E)=\frac{1}{\mu(E)}`,
      },
      {
        label: "Edge step",
        latex: String.raw`\Delta\mu = \mu(E_0+\Delta E)-\mu(E_0-\Delta E)`,
      },
      {
        label: "Complex refractive index",
        latex: String.raw`n = 1-\delta+i\beta`,
      },
    ],
    references: [REF_ELAM, REF_CHANTLER, REF_NIST_ATTEN],
    notes: ["Computed values are deterministic lookups plus algebraic transforms."],
  },
  "/scattering": {
    id: "/scattering",
    title: "Scattering Factors",
    theorySummary: [
      "Scattering Factors visualizes anomalous factors f' and f'' from Chantler tables across energy.",
      "These terms are used in resonant scattering, reflectivity, and diffraction calculations.",
    ],
    algorithmSteps: [
      "Create energy grid in user range.",
      "Evaluate f'(E) and f''(E) from Chantler tabulation.",
      "Plot main element and optional overlays for comparison.",
    ],
    equations: [
      {
        label: "Atomic scattering factor decomposition",
        latex: String.raw`f(E,q)=f_0(q)+f'(E)+i f''(E)`,
      },
      {
        label: "Energy-wavelength conversion",
        latex: String.raw`\lambda = \frac{hc}{E}`,
      },
    ],
    references: [REF_CHANTLER, REF_XRAYDB],
    notes: ["f' and f'' are tabulated anomalous terms; q-dependence here is not refit by the UI."],
  },
  "/ionchamber": {
    id: "/ionchamber",
    title: "Ion Chamber",
    theorySummary: [
      "Ion Chamber estimates flux attenuation and absorption in gas mixtures using Beer-Lambert attenuation with pressure-scaled path length.",
      "Mixture attenuation is formed by gas-fraction weighting of material attenuation.",
    ],
    algorithmSteps: [
      "Normalize gas fractions and compute effective chamber length from pressure.",
      "Compute gas-mixture attenuation and transmitted flux.",
      "Report absorption percentage and optional Compton reference energies.",
    ],
    equations: [
      {
        label: "Effective path length",
        latex: String.raw`L_{\mathrm{eff}} = L\left(\frac{P}{P_0}\right)`,
      },
      {
        label: "Mixture attenuation",
        latex: String.raw`\mu_{\mathrm{mix}}(E)=\sum_i x_i\,\mu_i(E),\quad \sum_i x_i=1`,
      },
      {
        label: "Transmission",
        latex: String.raw`I_t = I_0\exp\left[-\mu_{\mathrm{mix}}(E)L_{\mathrm{eff}}\right]`,
      },
      {
        label: "Compton shift",
        latex: String.raw`E' = \frac{E}{1+\frac{E}{m_ec^2}(1-\cos\theta)}`,
      },
    ],
    references: [REF_NIST_ATTEN, REF_COMPTON, REF_XRAYDB],
    notes: ["Gas ionization/electronics effects are simplified to the current model exposed by the WASM backend."],
  },
  "/reflectivity": {
    id: "/reflectivity",
    title: "Mirror Reflectivity",
    theorySummary: [
      "Reflectivity computes single-layer mirror response vs angle or energy using optical constants and Fresnel-style reflectivity evaluation.",
      "Surface roughness is included through a Nevot-Croce damping factor.",
    ],
    algorithmSteps: [
      "Compute delta and beta from material composition, density, and energy.",
      "Evaluate reflectivity for selected polarization and scan axis.",
      "Annotate critical angle from refractive decrement.",
    ],
    equations: [
      {
        label: "Critical angle (small-angle approximation)",
        latex: String.raw`\theta_c \approx \sqrt{2\delta}`,
      },
      {
        label: "Fresnel reflectivity",
        latex: String.raw`R = \left|\frac{k_{z,1}-k_{z,2}}{k_{z,1}+k_{z,2}}\right|^2`,
      },
      {
        label: "Roughness damping",
        latex: String.raw`R_{\sigma} = R\,\exp\left[-\left(\frac{4\pi\sigma\sin\theta}{\lambda}\right)^2\right]`,
      },
    ],
    references: [REF_PARRATT, REF_CHANTLER, REF_XRAYDB],
    notes: ["Model is for thick, single-layer mirrors; multilayer optics are out of scope here."],
  },
  "/darwin": {
    id: "/darwin",
    title: "Darwin Width",
    theorySummary: [
      "Darwin Width evaluates crystal reflection acceptance from dynamical diffraction and converts angular bandwidth to energy bandwidth.",
      "It is used to estimate monochromator and analyzer intrinsic resolution.",
    ],
    algorithmSteps: [
      "Solve Bragg condition for selected hkl and energy.",
      "Compute angular Darwin curve and full width metrics.",
      "Convert angular width to energy width around Bragg angle.",
    ],
    equations: [
      {
        label: "Bragg law",
        latex: String.raw`n\lambda = 2d\sin\theta_B`,
      },
      {
        label: "Angle-energy bandwidth relation",
        latex: String.raw`\frac{\Delta E}{E} \approx \cot\theta_B\,\Delta\theta`,
      },
    ],
    references: [REF_BRAGG, REF_DYNAMICAL, REF_XRAYDB],
    notes: ["Bandwidth values are intrinsic crystal responses and exclude source/divergence contributions."],
  },
  "/analyzers": {
    id: "/analyzers",
    title: "Analyzer Crystals",
    theorySummary: [
      "Analyzer selection scans crystal reflections that satisfy Bragg diffraction at target emission energy.",
      "Candidates are ranked with emphasis on high Bragg angle (near-backscattering) and narrow Darwin width.",
    ],
    algorithmSteps: [
      "Convert target emission energy to wavelength.",
      "Test crystal hkl reflections against Bragg condition.",
      "Report feasible reflections with Bragg angle and Darwin-width-related quality metrics.",
    ],
    equations: [
      {
        label: "Bragg condition for analyzer selection",
        latex: String.raw`\sin\theta_B = \frac{n\lambda}{2d_{hkl}}`,
      },
      {
        label: "Resolution scaling",
        latex: String.raw`\Delta E \approx E\cot\theta_B\,\Delta\theta_D`,
      },
    ],
    references: [REF_BRAGG, REF_DYNAMICAL, REF_XRAYDB],
    notes: ["Final analyzer choice should also consider spectrometer geometry and Johann/Johansson error."],
  },
  "/sample-weight": {
    id: "/sample-weight",
    title: "Sample Weight Calculator",
    theorySummary: [
      "Sample Weight solves for sample and diluent mass split that reaches a target edge step at fixed pellet area and total mass.",
      "The computation is linear in mass loading using edge-step coefficients from attenuation data.",
    ],
    algorithmSteps: [
      "Compute sample and diluent edge-step coefficients from mu(E0+delta)-mu(E0-delta).",
      "Solve two-equation linear system: target edge step and mass conservation.",
      "Report resulting masses and resulting transmission metrics.",
    ],
    equations: [
      {
        label: "Edge step from mass loading",
        latex: String.raw`\Delta\mu_{\mathrm{target}} = \Delta\mu_s\frac{m_s}{A} + \Delta\mu_d\frac{m_d}{A}`,
      },
      {
        label: "Mass conservation",
        latex: String.raw`m_s + m_d = m_{\mathrm{tot}}`,
      },
      {
        label: "Closed-form sample mass",
        latex: String.raw`m_s = \frac{\Delta\mu_{\mathrm{target}}A - \Delta\mu_d m_{\mathrm{tot}}}{\Delta\mu_s-\Delta\mu_d}`,
      },
    ],
    references: [REF_ELAM, REF_NIST_ATTEN, REF_XRAYDB],
    notes: ["Transmission suitability depends on both edge step and total absorption above edge."],
  },
  "/self-absorption": {
    id: "/self-absorption",
    title: "Self Absorption",
    theorySummary: [
      "Self Absorption evaluates fluorescence EXAFS amplitude suppression. The page exposes exact Ameyanagi suppression and Booth reference response.",
      "Calculations are point-by-point on the energy grid, retaining the full exponential form.",
    ],
    algorithmSteps: [
      "Compute compound and absorber attenuation terms from tabulated cross sections and density.",
      "Compute effective fluorescence attenuation and geometric factors.",
      "Evaluate exact suppression ratio R(E,chi)=chi_exp/chi for selected chi values.",
    ],
    equations: [
      {
        label: "Geometry factors",
        latex: String.raw`g=\frac{\sin\phi}{\sin\theta},\qquad \beta=\frac{d}{\sin\phi}`,
      },
      {
        label: "Suppression definitions",
        latex: String.raw`\alpha(E)=\bar\mu_T(E)+g\mu_f,\qquad A(E,\chi)=\alpha(E)+\bar\mu_a(E)(1+\chi)`,
      },
      {
        label: "Exact suppression ratio",
        latex: String.raw`R(E,\chi)=\frac{1}{\chi}\left[\frac{\alpha\left(1-e^{-A\beta}\right)}{A\left(1-e^{-\alpha\beta}\right)}\cdot\frac{\alpha(1+\chi)}{\alpha+\bar\mu_a}-1\right]`,
      },
    ],
    references: [REF_BOOTH, REF_TROGER, REF_REHR, REF_XRAYDB],
    notes: [
      "Angles are interpreted in degrees in the UI and converted internally to radians.",
      "Suppression is plotted as percent retained signal: 100*R.",
    ],
  },
  "/sample-preparation-helper": {
    id: "/sample-preparation-helper",
    title: "Sample Preparation Helper",
    theorySummary: [
      "Sample Preparation Helper combines transmission planning and fluorescence self-absorption planning in one workflow.",
      "It evaluates multiple scenarios (pure, dilution for target, fluorescence dilution/thickness) with physically constrained mass and geometry.",
    ],
    algorithmSteps: [
      "Solve transmission mass split from target edge step and pellet constraints.",
      "Evaluate exact self-absorption suppression R(E,chi) for each candidate composition.",
      "Classify cases using transmission and fluorescence thresholds.",
    ],
    equations: [
      {
        label: "Transmission mass-balance model",
        latex: String.raw`\Delta\mu_{\mathrm{mix}} = \Delta\mu_s\frac{m_s}{A}+\Delta\mu_d\frac{m_d}{A},\quad m_s+m_d=m_{\mathrm{tot}}`,
      },
      {
        label: "Fluorescence suitability metric",
        latex: String.raw`R_{\min}(\chi)=\min_E\,R(E,\chi)`,
      },
      {
        label: "Transmission and fluorescence criteria",
        latex: String.raw`0.2\le\Delta\mu\le2.0,\ \mu t\le4.0,\ R_{\min}\ge90\%`,
      },
    ],
    references: [REF_ELAM, REF_BOOTH, REF_XRAYDB],
    notes: [
      "The helper enforces non-negative mass solutions and reports when a requested target is not physically reachable.",
      "Fluorescence classification is based on minimum retained signal across the selected energy range.",
    ],
  },
};

export function getToolDoc(id: ToolDocId): ToolDoc {
  return TOOL_DOCS[id];
}

export function getToolDocByPath(pathname: string): ToolDoc | null {
  if (pathname === "/") return TOOL_DOCS["/"];
  if (pathname.startsWith("/element/")) return TOOL_DOCS["/element/$z"];

  const directMatch = Object.keys(TOOL_DOCS).find(
    (key) => key !== "/" && key !== "/element/$z" && pathname.startsWith(key),
  ) as ToolDocId | undefined;

  return directMatch ? TOOL_DOCS[directMatch] : null;
}

export { TOOL_DOCS };
