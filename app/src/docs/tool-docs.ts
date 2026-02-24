import type { ToolDoc, ToolDocId, ToolReference } from "~/docs/types";

const REF_XRAYDB_DOCS: ToolReference = {
  citation: "XrayDB documentation and API reference.",
  url: "https://xraypy.github.io/XrayDB/",
};

const REF_XRAYDB_PYTHON: ToolReference = {
  citation: "XrayDB Python API documentation (material_mu, xray_delta_beta, darwin_width, mirror_reflectivity).",
  url: "https://xraypy.github.io/XrayDB/python.html",
};

const REF_XRAYDB_EXAMPLES: ToolReference = {
  citation: "XrayDB calculations of X-ray properties of materials (worked theory examples).",
  url: "https://xraypy.github.io/XrayDB/examples.html",
};

const REF_XRAYDB_BIBLIO: ToolReference = {
  citation: "XrayDB bibliography and data-source references.",
  url: "https://xraypy.github.io/XrayDB/biblio.html",
};

const REF_ELAM: ToolReference = {
  citation:
    "Elam WT, Ravel BD, Sieber JR. A new atomic database for X-ray spectroscopic calculations. Radiation Physics and Chemistry 63 (2002) 121-128.",
  doi: "10.1016/S0969-806X(01)00227-4",
};

const REF_CHANTLER: ToolReference = {
  citation:
    "Chantler CT. Detailed tabulation of atomic form factors, photoelectric absorption and scattering cross section, and mass attenuation coefficients in the vicinity of absorption edges in the soft X-ray (Z=30-36, Z=60-89, E=0.1-10 keV), addressing convergence issues of earlier work. Journal of Physical and Chemical Reference Data 29 (2000) 597-1056.",
  doi: "10.1063/1.1321055",
};

const REF_WAASMAIER: ToolReference = {
  citation:
    "Waasmaier D, Kirfel A. New analytical scattering-factor functions for free atoms and ions. Acta Crystallographica A 51 (1995) 416-431.",
  doi: "10.1107/S0108767394013292",
};

const REF_KESKI_RAHKONEN: ToolReference = {
  citation:
    "Keski-Rahkonen O, Krause MO. Total and partial atomic-level widths. Atomic Data and Nuclear Data Tables 14 (1974) 139-146.",
  doi: "10.1016/S0092-640X(74)80020-3",
};

const REF_KRAUSE_OLIVER: ToolReference = {
  citation:
    "Krause MO, Oliver JH. Natural widths of atomic K and L levels, K alpha X-ray lines and several KLL Auger lines. Journal of Physical and Chemical Reference Data 8 (1979) 329-338.",
  doi: "10.1063/1.555595",
};

const REF_NIST_ATTEN: ToolReference = {
  citation:
    "Hubbell JH, Seltzer SM. Tables of X-Ray Mass Attenuation Coefficients and Mass Energy-Absorption Coefficients.",
  url: "https://www.nist.gov/pml/xray-mass-attenuation-coefficients",
};

const REF_PARRATT: ToolReference = {
  citation:
    "Parratt LG. Surface studies of solids by total reflection of X-rays. Physical Review 95 (1954) 359-369.",
  doi: "10.1103/PhysRev.95.359",
};

const REF_ALS_NIELSEN: ToolReference = {
  citation:
    "Als-Nielsen J, McMorrow D. Elements of Modern X-ray Physics, 2nd Edition. Wiley (2011).",
  doi: "10.1002/9781119998365",
};

const REF_DYNAMICAL: ToolReference = {
  citation: "Authier A. Dynamical Theory of X-ray Diffraction. Oxford University Press (2001).",
};

const REF_BRAGG: ToolReference = {
  citation:
    "Bragg WL. The diffraction of short electromagnetic waves by a crystal. Proceedings of the Cambridge Philosophical Society 17 (1913) 43-57.",
  url: "https://www.cambridge.org/core/journals/proceedings-of-the-cambridge-philosophical-society",
};

const REF_COMPTON: ToolReference = {
  citation:
    "Compton AH. A quantum theory of the scattering of X-rays by light elements. Physical Review 21 (1923) 483-502.",
  doi: "10.1103/PhysRev.21.483",
};

const REF_KNOLL: ToolReference = {
  citation: "Knoll GF. Radiation Detection and Measurement, 4th Edition. Wiley (2010).",
  doi: "10.1002/9780470131480",
};

const REF_TROGER: ToolReference = {
  citation:
    "Troger L, Arvanitis D, Baberschke K, Michaelis H, Grimm U, Zschech E. Full correction of the self-absorption in soft-fluorescence EXAFS. Physical Review B 46 (1992) 3283-3289.",
  doi: "10.1103/PhysRevB.46.3283",
};

const REF_BOOTH: ToolReference = {
  citation:
    "Booth CH, Bridges F. Improved self-absorption correction for fluorescence measurements of extended X-ray absorption fine-structure. Physica Scripta T115 (2005) 202-204.",
  doi: "10.1238/Physica.Topical.115a00202",
};

const REF_REHR: ToolReference = {
  citation:
    "Rehr JJ, Albers RC. Theoretical approaches to X-ray absorption fine structure. Reviews of Modern Physics 72 (2000) 621-654.",
  doi: "10.1103/RevModPhys.72.621",
};

const TOOL_DOCS: Record<ToolDocId, ToolDoc> = {
  "/": {
    id: "/",
    title: "Elements Overview",
    theorySummary: [
      "This page is the root index into the same tabulated X-ray atomic data used throughout XrayDB-style workflows: edges, lines, attenuation, and scattering terms.",
      "No fitting or inversion is done on this page. It provides validated atomic metadata and direct links into tool-specific calculations.",
    ],
    algorithmSteps: [
      "Resolve atomic symbol/number and elemental metadata.",
      "Expose edge and line lookup entry points for downstream calculators.",
      "Use consistent units (eV for energy, g/cm^3 for density) across linked tools.",
    ],
    equations: [
      {
        label: "Photon energy-wavelength conversion",
        latex: String.raw`E = \frac{hc}{\lambda}`,
        variables: [
          { symbol: "E", description: "photon energy", units: "eV" },
          { symbol: "\\lambda", description: "wavelength", units: "A" },
        ],
      },
    ],
    references: [REF_XRAYDB_DOCS, REF_XRAYDB_BIBLIO, REF_ELAM],
    notes: [
      "This page is a lookup/navigation layer and intentionally does not apply experimental broadening or detector models.",
    ],
  },

  "/element/$z": {
    id: "/element/$z",
    title: "Element Detail",
    theorySummary: [
      "Element detail combines atomic edges/lines with elemental attenuation channels from Elam data and anomalous-scattering context from Chantler/Waasmaier-Kirfel style factors.",
      "The overlays (Z-1 and Z-2 filters, edge and line markers) are intended for practical beamline filtering and fluorescence planning.",
    ],
    algorithmSteps: [
      "Load xray_edges and xray_lines for the selected element.",
      "Evaluate selected mu/rho channels on an energy grid centered on relevant edges.",
      "Annotate line and edge positions inside the visible plot window.",
      "Optionally overlay neighboring-element filter attenuation curves.",
    ],
    equations: [
      {
        label: "Mass to linear attenuation",
        latex: String.raw`\mu(E) = \rho\left(\frac{\mu}{\rho}\right)(E)`,
      },
      {
        label: "Beer-Lambert transmission",
        latex: String.raw`T(E) = \exp\left[-\mu(E)\,t\right]`,
      },
      {
        label: "Edge jump ratio",
        latex: String.raw`J = \frac{\mu(E_0^+)}{\mu(E_0^-)}`,
      },
    ],
    references: [REF_ELAM, REF_CHANTLER, REF_WAASMAIER, REF_KRAUSE_OLIVER, REF_KESKI_RAHKONEN],
    notes: [
      "Core-hole width and fluorescence-related metadata follow tabulated atomic references used in XrayDB.",
    ],
  },

  "/edges": {
    id: "/edges",
    title: "Edge Finder",
    theorySummary: [
      "Edge Finder performs nearest-energy matching against tabulated absorption edges. It is designed for monochromator setup and edge targeting.",
      "The harmonic options compare E, E/2, and E/3 against the edge table, which is useful for harmonic contamination checks.",
    ],
    algorithmSteps: [
      "Build the edge candidate set from tabulated edge energies.",
      "For each harmonic n in {1,2,3}, compute distance to each edge.",
      "Sort by absolute residual and return the nearest matches.",
    ],
    equations: [
      {
        label: "Nearest-edge residual",
        latex: String.raw`\Delta E_i = \left|\frac{E_{\mathrm{in}}}{n} - E_{\mathrm{edge},i}\right|,\quad n\in\{1,2,3\}`,
      },
      {
        label: "Rank criterion",
        latex: String.raw`\mathrm{rank}(i) \propto \min\,\Delta E_i`,
      },
    ],
    references: [REF_XRAYDB_DOCS, REF_ELAM],
    notes: ["This is a deterministic table-match tool; it does not include edge broadening or chemical-shift models."],
  },

  "/lines": {
    id: "/lines",
    title: "Line Finder",
    theorySummary: [
      "Line Finder identifies the closest tabulated fluorescence/emission transitions to a user energy.",
      "It is intended for rapid line identification and analyzer-energy targeting.",
    ],
    algorithmSteps: [
      "Assemble line candidates with energy and relative intensity metadata.",
      "Compute residual to user energy for each line.",
      "Sort and display nearest lines with transition labels.",
    ],
    equations: [
      {
        label: "Nearest-line residual",
        latex: String.raw`\Delta E_i = \left|E_{\mathrm{in}} - E_{\mathrm{line},i}\right|`,
      },
      {
        label: "Relative line weighting (display metric)",
        latex: String.raw`I_i^{\mathrm{rel}} = \frac{I_i}{\sum_j I_j}`,
      },
    ],
    references: [REF_XRAYDB_DOCS, REF_ELAM, REF_KESKI_RAHKONEN],
    notes: ["Displayed line intensities are relative table values and are not detector-efficiency corrected."],
  },

  "/attenuation": {
    id: "/attenuation",
    title: "X-ray Attenuation",
    theorySummary: [
      "This calculator follows the XrayDB material attenuation workflow: evaluate mass attenuation by composition, then scale by density to linear attenuation.",
      "Users can separate total, photoelectric, coherent, and incoherent channels across energy.",
    ],
    algorithmSteps: [
      "Parse chemical formula into elemental composition.",
      "Compute elemental mass fractions and weighted mass attenuation.",
      "Scale by density to get linear attenuation in 1/cm.",
      "Plot selected channel(s) for one or more materials.",
    ],
    equations: [
      {
        label: "Mixture mass attenuation",
        latex: String.raw`\left(\frac{\mu}{\rho}\right)_{\mathrm{mix}}(E)=\sum_i w_i\left(\frac{\mu}{\rho}\right)_i(E),\quad \sum_i w_i=1`,
      },
      {
        label: "Linear attenuation",
        latex: String.raw`\mu(E)=\rho\left(\frac{\mu}{\rho}\right)_{\mathrm{mix}}(E)`,
      },
      {
        label: "Transmission",
        latex: String.raw`T(E)=\exp[-\mu(E)t]`,
      },
    ],
    references: [REF_ELAM, REF_NIST_ATTEN, REF_XRAYDB_PYTHON, REF_XRAYDB_EXAMPLES],
    notes: ["Output mu values are linear attenuation coefficients in cm^-1."],
  },

  "/formulas": {
    id: "/formulas",
    title: "Absorption Formulas",
    theorySummary: [
      "This page combines attenuation and refractive-index formulas exposed by xray_delta_beta and material_mu style calculations.",
      "It reports absorption length, edge-step proxies, delta/beta, transmission, and per-element contributions in one place.",
    ],
    algorithmSteps: [
      "Evaluate total and channel-specific mu at the selected energy.",
      "Compute refractive-index terms from composition, density, and energy.",
      "Estimate edge-step and sample-thickness transmission metrics.",
      "Break down elemental contribution with weight-fraction scaling.",
    ],
    equations: [
      {
        label: "Complex refractive index",
        latex: String.raw`n(E)=1-\delta(E)-i\beta(E)`,
      },
      {
        label: "Attenuation length from beta",
        latex: String.raw`\mu(E)=\frac{4\pi\beta(E)}{\lambda},\qquad \ell_{\mathrm{att}}=\frac{1}{\mu}=\frac{\lambda}{4\pi\beta}`,
      },
      {
        label: "Transmission",
        latex: String.raw`T=\exp[-\mu(E)t]`,
      },
      {
        label: "Edge-step estimate",
        latex: String.raw`\Delta\mu \approx \mu(E_0+\Delta E)-\mu(E_0-\Delta E)`,
      },
    ],
    references: [REF_XRAYDB_PYTHON, REF_ELAM, REF_CHANTLER, REF_NIST_ATTEN],
    notes: [
      "In this UI, unit-edge-step style values are computed numerically from finite differences around the nearest selected edge.",
    ],
  },

  "/scattering": {
    id: "/scattering",
    title: "Scattering Factors",
    theorySummary: [
      "Scattering factors use Chantler tables for f' and f'' across energy, consistent with XrayDB scattering APIs.",
      "The decomposition into f0(q), f'(E), and if''(E) is the standard X-ray elastic scattering representation.",
    ],
    algorithmSteps: [
      "Create user-defined energy grid.",
      "Evaluate f'(E) and f''(E) from Chantler tabulation.",
      "Plot selected element plus optional overlays.",
    ],
    equations: [
      {
        label: "Scattering factor decomposition",
        latex: String.raw`f(q,E)=f_0(q)+f'(E)+i f''(E)`,
      },
      {
        label: "Relation to absorption (optical theorem context)",
        latex: String.raw`f''(E) \propto \mu(E)`,
      },
    ],
    references: [REF_CHANTLER, REF_WAASMAIER, REF_XRAYDB_PYTHON],
    notes: ["The page directly visualizes tabulated anomalous terms; it does not fit dispersion corrections."],
  },

  "/ionchamber": {
    id: "/ionchamber",
    title: "Ion Chamber",
    theorySummary: [
      "This implementation follows the XrayDB ion-chamber example: gas attenuation from composition and pressure-scaled path length, then absorbed flux conversion.",
      "Compton energies are provided as diagnostic scattering references.",
    ],
    algorithmSteps: [
      "Build effective gas attenuation from fractional gas composition.",
      "Scale path length by pressure relative to reference pressure.",
      "Compute transmitted and absorbed fractions.",
      "Convert absorbed fraction to flux/current estimates using ionization potential assumptions.",
    ],
    equations: [
      {
        label: "Gas attenuation coefficient",
        latex: String.raw`\mu_{\mathrm{gas}}(E)=\sum_i f_i\,\rho_i\left(\frac{\mu}{\rho}\right)_i(E)`,
      },
      {
        label: "Attenuated intensity",
        latex: String.raw`I_{\mathrm{atten}}=\exp\left[-\mu_{\mathrm{gas}}(E)\,x\,\frac{P}{P_0}\right]`,
      },
      {
        label: "Absorbed flux",
        latex: String.raw`\Phi_{\mathrm{abs}}=\Phi_0\left(1-I_{\mathrm{atten}}\right)`,
      },
      {
        label: "Compton shift",
        latex: String.raw`E' = \frac{E}{1+\frac{E}{m_ec^2}(1-\cos\theta)}`,
      },
    ],
    references: [REF_XRAYDB_EXAMPLES, REF_COMPTON, REF_KNOLL, REF_NIST_ATTEN],
    notes: ["This model assumes uniform gas path and uses the current backend ionization/flux conventions."],
  },

  "/reflectivity": {
    id: "/reflectivity",
    title: "Mirror Reflectivity",
    theorySummary: [
      "Reflectivity follows the XrayDB reflectivity approach: refractive-index parameters from composition and density, then Fresnel/Parratt-style reflectivity for grazing incidence.",
      "Critical angle and roughness effects are included for practical mirror material comparison.",
    ],
    algorithmSteps: [
      "Compute delta and beta at energy E for each material.",
      "Evaluate reflectivity vs angle (or energy) at selected polarization.",
      "Apply roughness attenuation and report critical-angle context.",
    ],
    equations: [
      {
        label: "Refractive index",
        latex: String.raw`n=1-\delta-i\beta`,
      },
      {
        label: "Critical angle (small-angle limit)",
        latex: String.raw`\theta_c\approx\sqrt{2\delta}`,
      },
      {
        label: "Fresnel reflectivity",
        latex: String.raw`R=\left|\frac{k_{z,1}-k_{z,2}}{k_{z,1}+k_{z,2}}\right|^2`,
      },
      {
        label: "Roughness damping (Nevot-Croce form)",
        latex: String.raw`R_{\sigma}=R\exp\left[-\left(\frac{4\pi\sigma\sin\theta}{\lambda}\right)^2\right]`,
      },
    ],
    references: [REF_XRAYDB_PYTHON, REF_XRAYDB_EXAMPLES, REF_PARRATT, REF_ALS_NIELSEN],
    notes: ["Current page models a single thick layer; multilayer interference stacks are out of scope."],
  },

  "/darwin": {
    id: "/darwin",
    title: "Darwin Width",
    theorySummary: [
      "Darwin width calculations follow dynamical diffraction treatment and are consistent with the XrayDB darwin_width API behavior.",
      "The page converts angular acceptance into equivalent energy resolution around Bragg condition.",
    ],
    algorithmSteps: [
      "Solve Bragg condition for crystal reflection and energy.",
      "Compute Darwin curve and FWHM in angle.",
      "Convert angle bandwidth to energy bandwidth near theta_B.",
      "Expose rocking-curve variants used for monochromator and analyzer checks.",
    ],
    equations: [
      {
        label: "Bragg law",
        latex: String.raw`n\lambda = 2d\sin\theta_B`,
      },
      {
        label: "Darwin reduced angle (XrayDB example notation)",
        latex: String.raw`\zeta=\frac{\theta-\theta_B}{\gamma_H}`,
      },
      {
        label: "Energy-angle relation",
        latex: String.raw`\frac{\Delta E}{E}\approx \cot\theta_B\,\Delta\theta`,
      },
    ],
    references: [REF_XRAYDB_PYTHON, REF_XRAYDB_EXAMPLES, REF_BRAGG, REF_DYNAMICAL],
    notes: ["Bandwidths reported here are intrinsic crystal responses and do not include source divergence or analyzer geometry errors."],
  },

  "/analyzers": {
    id: "/analyzers",
    title: "Analyzer Crystals",
    theorySummary: [
      "Analyzer selection uses emission-line energies and crystal reflection constraints from Bragg diffraction.",
      "The ranking strategy favors high Bragg angle (near backscattering) and narrow intrinsic Darwin width.",
    ],
    algorithmSteps: [
      "Select emission line energy from tabulated xray_lines data.",
      "Evaluate feasible reflections (hkl) with darwin_width API.",
      "Filter by user Bragg-angle window and sort by descending angle.",
      "Report angular and energy width metrics for decision support.",
    ],
    equations: [
      {
        label: "Reflection feasibility",
        latex: String.raw`\sin\theta_B = \frac{n\lambda}{2d_{hkl}}`,
      },
      {
        label: "Resolution estimate",
        latex: String.raw`\Delta E \approx E\cot\theta_B\,\Delta\theta_D`,
      },
    ],
    references: [REF_BRAGG, REF_DYNAMICAL, REF_XRAYDB_PYTHON],
    notes: ["Final analyzer choice should still include instrument geometry, Johann error, and detector acceptance."],
  },

  "/sample-weight": {
    id: "/sample-weight",
    title: "Sample Weight Calculator",
    theorySummary: [
      "Sample/diluent masses are solved from linear attenuation edge-step mixing at fixed pellet mass and illuminated area.",
      "This mirrors standard transmission-pellet planning where target edge step is specified and mass loading is solved algebraically.",
    ],
    algorithmSteps: [
      "Compute sample and diluent edge-step coefficients from attenuation around the chosen edge.",
      "Solve mass-balance plus target-edge-step equations.",
      "Compute resulting transmission metrics above/below edge.",
      "Report physically invalid cases when negative masses are required.",
    ],
    equations: [
      {
        label: "Target edge-step equation",
        latex: String.raw`\Delta\mu_{\mathrm{target}} = \Delta\mu_s\frac{m_s}{A}+\Delta\mu_d\frac{m_d}{A}`,
      },
      {
        label: "Mass conservation",
        latex: String.raw`m_s + m_d = m_{\mathrm{tot}}`,
      },
      {
        label: "Closed-form sample mass",
        latex: String.raw`m_s = \frac{\Delta\mu_{\mathrm{target}}A - \Delta\mu_d m_{\mathrm{tot}}}{\Delta\mu_s-\Delta\mu_d}`,
      },
      {
        label: "Transmission check",
        latex: String.raw`T=\exp[-\mu t]`,
      },
    ],
    references: [REF_ELAM, REF_NIST_ATTEN, REF_XRAYDB_EXAMPLES],
    notes: ["Transmission suitability is evaluated jointly from edge step and total above-edge absorption."],
  },

  "/self-absorption": {
    id: "/self-absorption",
    title: "Self Absorption",
    theorySummary: [
      "This page evaluates fluorescence EXAFS self-absorption using exact Ameyanagi suppression ratio R(E,chi) and Booth reference traces.",
      "Computation is fully numerical on the energy grid and retains full exponential expressions (no thin/thick asymptotic approximation in the exact branch).",
    ],
    algorithmSteps: [
      "Compute mu terms for compound, absorber contribution, and effective fluorescence attenuation.",
      "Construct geometric factors g and beta from incidence/exit angles and thickness.",
      "Evaluate exact suppression ratio R(E,chi)=chi_exp/chi point-by-point.",
      "Summarize min/mean/max retained signal and compare to Booth reference behavior.",
    ],
    equations: [
      {
        label: "Geometry",
        latex: String.raw`g=\frac{\sin\phi}{\sin\theta},\qquad \beta=\frac{d}{\sin\phi}`,
      },
      {
        label: "Attenuation terms",
        latex: String.raw`\alpha(E)=\bar\mu_T(E)+g\mu_f,\qquad A(E,\chi)=\alpha(E)+\bar\mu_a(E)(1+\chi)`,
      },
      {
        label: "Exact suppression ratio",
        latex: String.raw`R(E,\chi)=\frac{1}{\chi}\left[\frac{\alpha\left(1-e^{-A\beta}\right)}{A\left(1-e^{-\alpha\beta}\right)}\cdot\frac{\alpha(1+\chi)}{\alpha+\bar\mu_a}-1\right]`,
      },
    ],
    references: [REF_BOOTH, REF_TROGER, REF_REHR, REF_XRAYDB_EXAMPLES],
    notes: [
      "UI angles are entered in degrees and converted to radians internally.",
      "Displayed retained signal is 100*R(E,chi) in percent.",
    ],
  },

  "/sample-preparation-helper": {
    id: "/sample-preparation-helper",
    title: "Sample Preparation Helper",
    theorySummary: [
      "This helper combines transmission planning and fluorescence self-absorption planning using the same attenuation and exact suppression engine as the dedicated tools.",
      "It evaluates pure, target-diluted, suggested, fluorescence-dilution, and fluorescence-thickness scenarios under fixed pellet geometry.",
    ],
    algorithmSteps: [
      "Build attenuation coefficients for sample and diluent around edge and across selected energy range.",
      "Solve candidate mass splits for requested edge-step goals.",
      "Run exact R(E,chi) calculation for each physically valid case.",
      "Classify each case with transmission and fluorescence thresholds and show best feasible options.",
    ],
    equations: [
      {
        label: "Edge-step mixing model",
        latex: String.raw`\Delta\mu_{\mathrm{mix}}=\Delta\mu_s\frac{m_s}{A}+\Delta\mu_d\frac{m_d}{A},\quad m_s+m_d=m_{\mathrm{tot}}`,
      },
      {
        label: "Suppression objective",
        latex: String.raw`R_{\min}(\chi)=\min_E R(E,\chi)`,
      },
      {
        label: "Decision thresholds used in UI",
        latex: String.raw`0.2\le\Delta\mu\le2.0,\quad \mu t\le4.0,\quad R_{\min}\ge 90\%`,
      },
    ],
    references: [REF_ELAM, REF_BOOTH, REF_TROGER, REF_XRAYDB_EXAMPLES],
    notes: [
      "When a target edge step is infeasible under non-negative mass constraints, the helper reports the reachable range instead of forcing an invalid solution.",
      "For fluorescence-thickness mode, if the input sample-only case already satisfies R_min >= 90%, the input mass/thickness is kept.",
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
