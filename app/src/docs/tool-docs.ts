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
  doi: "10.1093/acprof:oso/9780198528920.001.0001",
};

const REF_BRAGG: ToolReference = {
  citation:
    "Bragg WL. The diffraction of short electromagnetic waves by a crystal. Proceedings of the Cambridge Philosophical Society 17 (1913) 43-57.",
  doi: "10.1017/S0305004100003678",
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

const REF_AMEYANAGI: ToolReference = {
  citation:
    "Ameyanagi H, Booth CH. Exact self-absorption correction for fluorescence EXAFS: a unified treatment for arbitrary sample thickness and geometry.",
};

const REF_NEVOT_CROCE: ToolReference = {
  citation:
    "Nevot L, Croce P. Caracterisation des surfaces par reflexion rasante de rayons X. Application a l'etude du polissage de quelques verres silicates. Revue de Physique Appliquee 15 (1980) 761-779.",
  doi: "10.1051/rphysap:01980001503076100",
};

const REF_BUNKER: ToolReference = {
  citation:
    "Bunker G. Introduction to XAFS: A Practical Guide to X-ray Absorption Fine Structure Spectroscopy. Cambridge University Press (2010).",
  doi: "10.1017/CBO9780511809194",
};

const TOOL_DOCS: Record<ToolDocId, ToolDoc> = {
  "/": {
    id: "/",
    title: "Elements Overview",
    theorySummary: [
      "This page provides the root index into tabulated X-ray atomic data: element properties, absorption edges, emission lines, and links into tool-specific calculations.",
      "Data comes from the XrayDB Elam database. No fitting or inversion is done on this page; it serves as a validated reference and navigation layer.",
    ],
    algorithmSteps: [
      "Resolve atomic symbol/number and retrieve elemental metadata (molar mass, density).",
      "Display interactive periodic table for element selection.",
      "Provide edge and line lookup entry points for downstream calculators.",
    ],
    equations: [
      {
        label: "Photon energy-wavelength conversion",
        latex: String.raw`E = \frac{hc}{\lambda}`,
        variables: [
          { symbol: "E", description: "photon energy", units: "eV" },
          { symbol: "\\lambda", description: "wavelength", units: "A" },
          { symbol: "hc", description: "Planck constant times speed of light (12398.4 eV*A)" },
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
        variables: [
          { symbol: "\\rho", description: "element density", units: "g/cm^3" },
          { symbol: "(\\mu/\\rho)", description: "mass attenuation coefficient", units: "cm^2/g" },
        ],
      },
      {
        label: "Beer-Lambert transmission",
        latex: String.raw`T(E) = \exp\left[-\mu(E)\,t\right]`,
      },
      {
        label: "Edge jump ratio",
        latex: String.raw`J = \frac{\mu(E_0^+)}{\mu(E_0^-)}`,
        variables: [
          { symbol: "J", description: "ratio of attenuation just above to just below the edge" },
          { symbol: "E_0", description: "absorption edge energy", units: "eV" },
        ],
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
      "Edge Finder performs nearest-energy matching against tabulated absorption edges from the Elam database. It is designed for monochromator setup, edge targeting, and harmonic contamination checks.",
      "The harmonic buttons divide the input energy by 2 or 3 before matching, enabling quick identification of edges that could be excited by harmonics. A scatter plot shows all edges (energy vs Z) with the search energy marked.",
    ],
    algorithmSteps: [
      "Build the complete edge candidate set from all elements (Z=1-92) with K, L, and optionally M edges.",
      "Apply harmonic division: effective energy = E_in / n where n = 1, 2, or 3.",
      "Sort by absolute distance to effective energy and highlight the closest match.",
      "Use guess_edge() for the quick-match banner; display all edges in a scrollable sortable table.",
    ],
    equations: [
      {
        label: "Nearest-edge residual",
        latex: String.raw`\Delta E_i = \left|\frac{E_{\mathrm{in}}}{n} - E_{\mathrm{edge},i}\right|,\quad n\in\{1,2,3\}`,
        variables: [
          { symbol: "E_{\\mathrm{in}}", description: "user-entered photon energy", units: "eV" },
          { symbol: "n", description: "harmonic order (1 = fundamental)" },
          { symbol: "E_{\\mathrm{edge},i}", description: "tabulated edge energy", units: "eV" },
        ],
      },
    ],
    references: [REF_XRAYDB_DOCS, REF_ELAM],
    notes: [
      "This is a deterministic table-match tool; it does not include edge broadening or chemical-shift models.",
      "Fluorescence yield and jump ratio are shown for each edge from the Elam database.",
    ],
  },

  "/lines": {
    id: "/lines",
    title: "Line Finder",
    theorySummary: [
      "Line Finder identifies the closest tabulated fluorescence/emission transitions to a user energy from the Elam database.",
      "It is intended for rapid line identification and analyzer-energy targeting. Lines are grouped by family (K-alpha, K-beta, L-alpha, L-beta, etc.) and can be filtered by family or sorted by energy/intensity.",
    ],
    algorithmSteps: [
      "Assemble line candidates from all elements with energy, intensity, and transition labels.",
      "Filter by line family (Ka, Kb, La, Lb, and optionally Lg, Ma, Mb).",
      "Compute distance to user energy and highlight the closest match in the sorted table.",
    ],
    equations: [
      {
        label: "Nearest-line residual",
        latex: String.raw`\Delta E_i = \left|E_{\mathrm{in}} - E_{\mathrm{line},i}\right|`,
        variables: [
          { symbol: "E_{\\mathrm{in}}", description: "user-entered photon energy", units: "eV" },
          { symbol: "E_{\\mathrm{line},i}", description: "tabulated emission line energy", units: "eV" },
        ],
      },
    ],
    references: [REF_XRAYDB_DOCS, REF_ELAM, REF_KESKI_RAHKONEN],
    notes: [
      "Displayed line intensities are relative table values from the Elam database and are not detector-efficiency corrected.",
      "Transition labels show initial and final atomic levels (e.g., K -> L3 for K-alpha-1).",
    ],
  },

  "/attenuation": {
    id: "/attenuation",
    title: "X-ray Attenuation",
    theorySummary: [
      "This calculator follows the XrayDB material attenuation workflow: evaluate mass attenuation by composition, then scale by density to linear attenuation.",
      "The total cross-section is decomposed into photoelectric, coherent (Rayleigh), and incoherent (Compton) channels. Elemental mass attenuation coefficients come from the Elam database.",
    ],
    algorithmSteps: [
      "Parse chemical formula into elemental composition and compute mass fractions w_i.",
      "Retrieve tabulated mass attenuation for each element and selected channel.",
      "Weight-sum to get mixture mass attenuation, then scale by density to produce linear attenuation in 1/cm.",
      "Plot selected channel(s) across the energy grid; overlay additional materials if requested.",
    ],
    equations: [
      {
        label: "Mixture mass attenuation",
        latex: String.raw`\left(\frac{\mu}{\rho}\right)_{\mathrm{mix}}(E)=\sum_i w_i\left(\frac{\mu}{\rho}\right)_i(E),\quad \sum_i w_i=1`,
        variables: [
          { symbol: "w_i", description: "mass fraction of element i" },
          { symbol: "(\\mu/\\rho)_i", description: "mass attenuation coefficient of element i", units: "cm^2/g" },
        ],
      },
      {
        label: "Linear attenuation",
        latex: String.raw`\mu(E)=\rho\left(\frac{\mu}{\rho}\right)_{\mathrm{mix}}(E)`,
        variables: [
          { symbol: "\\mu", description: "linear attenuation coefficient", units: "1/cm" },
          { symbol: "\\rho", description: "material density", units: "g/cm^3" },
        ],
      },
      {
        label: "Transmission (Beer-Lambert)",
        latex: String.raw`T(E)=\exp[-\mu(E)\,t]`,
        variables: [
          { symbol: "T", description: "transmitted fraction (0 to 1)" },
          { symbol: "t", description: "sample thickness", units: "cm" },
        ],
      },
    ],
    references: [REF_ELAM, REF_NIST_ATTEN, REF_XRAYDB_PYTHON, REF_XRAYDB_EXAMPLES],
    notes: [
      "Output mu values are linear attenuation coefficients in cm^{-1}.",
      "The total cross-section equals the sum of photoelectric, coherent, and incoherent contributions: mu_total = mu_photo + mu_coh + mu_incoh.",
    ],
  },

  "/formulas": {
    id: "/formulas",
    title: "Absorption Formulas",
    theorySummary: [
      "This page combines attenuation and refractive-index formulas exposed by xray_delta_beta and material_mu style calculations.",
      "It reports absorption length, edge-step proxies, delta/beta, transmission, per-element contributions (in barns/atom and cm^2/g), and sample mass estimates in one place.",
    ],
    algorithmSteps: [
      "Evaluate total and photoelectric mu at the selected energy via material_mu.",
      "Compute refractive-index terms (delta, beta, attenuation length) from xray_delta_beta.",
      "Estimate unit edge step from finite-difference mu at +/-50 eV around nearest absorption edge.",
      "Break down per-element contributions using mass fractions and elemental mu_elam values.",
    ],
    equations: [
      {
        label: "Complex refractive index",
        latex: String.raw`n(E)=1-\delta(E)-i\beta(E)`,
        variables: [
          { symbol: "\\delta", description: "refractive index decrement" },
          { symbol: "\\beta", description: "absorption index" },
        ],
      },
      {
        label: "Attenuation length from beta",
        latex: String.raw`\mu(E)=\frac{4\pi\beta(E)}{\lambda},\qquad \ell_{\mathrm{att}}=\frac{1}{\mu}=\frac{\lambda}{4\pi\beta}`,
        variables: [
          { symbol: "\\ell_{\\mathrm{att}}", description: "attenuation length (1/e depth)", units: "cm" },
          { symbol: "\\lambda", description: "X-ray wavelength", units: "cm" },
        ],
      },
      {
        label: "Transmission",
        latex: String.raw`T=\exp[-\mu(E)\,t]`,
      },
      {
        label: "Unit edge step (numerical estimate)",
        latex: String.raw`\Delta\mu \approx \mu(E_0+50) - \mu(E_0-50),\qquad t_{\mathrm{unit}} = \frac{1}{\Delta\mu}`,
        variables: [
          { symbol: "E_0", description: "absorption edge energy", units: "eV" },
          { symbol: "t_{\\mathrm{unit}}", description: "thickness for unit edge step (Delta-mu * t = 1)", units: "cm" },
        ],
      },
      {
        label: "Elemental cross-section conversion",
        latex: String.raw`\sigma_i\,[\mathrm{barns/atom}] = \frac{(\mu/\rho)_i \cdot M_i}{N_A} \times 10^{24}`,
        variables: [
          { symbol: "(\\mu/\\rho)_i", description: "mass attenuation coefficient of element i", units: "cm^2/g" },
          { symbol: "M_i", description: "molar mass of element i", units: "g/mol" },
          { symbol: "N_A", description: "Avogadro number (6.022e23 mol^{-1})" },
        ],
      },
    ],
    references: [REF_XRAYDB_PYTHON, REF_ELAM, REF_CHANTLER, REF_NIST_ATTEN],
    notes: [
      "In this UI, unit-edge-step values are computed numerically from finite differences (+/- 50 eV) around the nearest absorption edge of a formula component.",
      "Elemental cross-sections are displayed in both barns/atom and cm^2/g for convenience.",
    ],
  },

  "/scattering": {
    id: "/scattering",
    title: "Scattering Factors",
    theorySummary: [
      "Scattering factors use Chantler tables for f'(E) and f''(E) across energy, consistent with XrayDB scattering APIs.",
      "The decomposition into f_0(q), f'(E), and if''(E) is the standard X-ray elastic scattering representation. f_0 uses Waasmaier-Kirfel analytical functions; f' and f'' are interpolated from Chantler tabulations.",
    ],
    algorithmSteps: [
      "Create user-defined energy grid.",
      "Evaluate f'(E) and f''(E) from Chantler tabulation via interpolation.",
      "Plot selected element plus optional overlays for comparison.",
    ],
    equations: [
      {
        label: "Scattering factor decomposition",
        latex: String.raw`f(q,E)=f_0(q)+f'(E)+i\,f''(E)`,
        variables: [
          { symbol: "f_0(q)", description: "Thomson scattering factor (angle-dependent, dimensionless)" },
          { symbol: "f'(E)", description: "real part of anomalous scattering correction", units: "e^-" },
          { symbol: "f''(E)", description: "imaginary part of anomalous scattering correction", units: "e^-" },
          { symbol: "q", description: "momentum transfer", units: "1/A" },
        ],
      },
      {
        label: "Optical theorem relation",
        latex: String.raw`f''(E) = \frac{E}{2 h c r_e}\,\sigma_{\mathrm{tot}}(E) \propto \mu(E)`,
        variables: [
          { symbol: "r_e", description: "classical electron radius (2.818 fm)" },
          { symbol: "\\sigma_{\\mathrm{tot}}", description: "total photoabsorption cross-section", units: "cm^2" },
        ],
      },
    ],
    references: [REF_CHANTLER, REF_WAASMAIER, REF_XRAYDB_PYTHON],
    notes: [
      "The page directly visualizes tabulated anomalous terms; it does not fit dispersion corrections.",
      "f_0(q) is available via the WASM API but not plotted on this page.",
    ],
  },

  "/ionchamber": {
    id: "/ionchamber",
    title: "Ion Chamber",
    theorySummary: [
      "This implementation follows the XrayDB ion-chamber example: gas attenuation from composition and pressure-scaled path length, then absorbed flux conversion.",
      "The sensitivity parameter (A/V) converts the measured voltage from the current amplifier into ionization current. Incident flux is recovered from absorbed flux using the gas attenuation model. Compton energies are provided as diagnostic scattering references.",
    ],
    algorithmSteps: [
      "Build effective gas attenuation from fractional gas composition using Elam mass attenuation data.",
      "Scale path length by pressure relative to standard pressure (760 Torr).",
      "Compute transmitted and absorbed fractions from Beer-Lambert law.",
      "Convert absorbed current to photon flux using gas ionization potential and photon energy.",
    ],
    equations: [
      {
        label: "Gas attenuation coefficient",
        latex: String.raw`\mu_{\mathrm{gas}}(E)=\sum_i f_i\,\rho_i\left(\frac{\mu}{\rho}\right)_i(E)`,
        variables: [
          { symbol: "f_i", description: "gas volume fraction (must sum to 1)" },
          { symbol: "\\rho_i", description: "gas density at standard conditions", units: "g/cm^3" },
        ],
      },
      {
        label: "Attenuated intensity (pressure-scaled Beer-Lambert)",
        latex: String.raw`I_{\mathrm{atten}}=\exp\left[-\mu_{\mathrm{gas}}(E)\,x\,\frac{P}{P_0}\right]`,
        variables: [
          { symbol: "x", description: "chamber path length", units: "cm" },
          { symbol: "P", description: "gas pressure", units: "Torr" },
          { symbol: "P_0", description: "reference pressure (760 Torr)" },
        ],
      },
      {
        label: "Absorbed flux",
        latex: String.raw`\Phi_{\mathrm{abs}}=\Phi_0\left(1-I_{\mathrm{atten}}\right)`,
        variables: [
          { symbol: "\\Phi_0", description: "incident photon flux", units: "photons/s" },
          { symbol: "\\Phi_{\\mathrm{abs}}", description: "absorbed photon flux", units: "photons/s" },
        ],
      },
      {
        label: "Flux from amplifier reading",
        latex: String.raw`\Phi_0 = \frac{V \cdot S \cdot E_{\mathrm{ion}}}{e \cdot E_{\mathrm{photon}} \cdot (1 - I_{\mathrm{atten}})}`,
        variables: [
          { symbol: "V", description: "voltage reading from amplifier", units: "V" },
          { symbol: "S", description: "current amplifier sensitivity", units: "A/V" },
          { symbol: "E_{\\mathrm{ion}}", description: "average gas ionization potential", units: "eV" },
          { symbol: "e", description: "electron charge (1.602e-19 C)" },
        ],
      },
      {
        label: "Compton shift",
        latex: String.raw`E' = \frac{E}{1+\frac{E}{m_ec^2}(1-\cos\theta)}`,
        variables: [
          { symbol: "E'", description: "scattered photon energy", units: "eV" },
          { symbol: "m_e c^2", description: "electron rest mass energy (511 keV)" },
          { symbol: "\\theta", description: "scattering angle" },
        ],
      },
    ],
    references: [REF_XRAYDB_EXAMPLES, REF_COMPTON, REF_KNOLL, REF_NIST_ATTEN],
    notes: [
      "This model assumes uniform gas path and uses standard gas densities at STP.",
      "When 'Both charge carriers' is checked, each ionization event produces two charge carriers (electron + ion), doubling the collected current.",
    ],
  },

  "/reflectivity": {
    id: "/reflectivity",
    title: "Mirror Reflectivity",
    theorySummary: [
      "Reflectivity follows the XrayDB reflectivity approach: refractive-index parameters from composition and density, then Fresnel/Parratt-style reflectivity for grazing incidence.",
      "Critical angle and roughness effects are included for practical mirror material comparison. Two plot modes are available: reflectivity vs grazing angle at fixed energy, and reflectivity vs energy at fixed angle.",
    ],
    algorithmSteps: [
      "Compute refractive-index terms delta and beta at energy E for each selected material via xray_delta_beta.",
      "Evaluate reflectivity vs angle (or energy) at selected polarization (s, p, or unpolarized).",
      "Apply Nevot-Croce roughness damping and annotate critical angle on angle-scan plots.",
    ],
    equations: [
      {
        label: "Complex refractive index",
        latex: String.raw`n=1-\delta-i\beta`,
        variables: [
          { symbol: "\\delta", description: "refractive index decrement (real dispersion)" },
          { symbol: "\\beta", description: "absorption index (imaginary part)" },
        ],
      },
      {
        label: "Critical angle (small-angle limit)",
        latex: String.raw`\theta_c\approx\sqrt{2\delta}`,
        variables: [
          { symbol: "\\theta_c", description: "critical angle for total external reflection", units: "rad" },
        ],
      },
      {
        label: "Fresnel reflectivity (s-polarization)",
        latex: String.raw`R=\left|\frac{k_{z,1}-k_{z,2}}{k_{z,1}+k_{z,2}}\right|^2`,
        variables: [
          { symbol: "k_{z,j}", description: "z-component of wave vector in medium j" },
        ],
      },
      {
        label: "Roughness damping (Nevot-Croce)",
        latex: String.raw`R_{\sigma}=R\exp\left[-\left(\frac{4\pi\sigma\sin\theta}{\lambda}\right)^2\right]`,
        variables: [
          { symbol: "\\sigma", description: "rms surface roughness", units: "A" },
          { symbol: "\\lambda", description: "X-ray wavelength", units: "A" },
        ],
      },
    ],
    references: [REF_XRAYDB_PYTHON, REF_XRAYDB_EXAMPLES, REF_PARRATT, REF_ALS_NIELSEN, REF_NEVOT_CROCE],
    notes: [
      "Current page models a single thick substrate; multilayer interference stacks are out of scope.",
      "Angle inputs are in mrad; the code converts to radians internally for the reflectivity calculation.",
    ],
  },

  "/darwin": {
    id: "/darwin",
    title: "Darwin Width",
    theorySummary: [
      "Darwin width calculations follow the dynamical diffraction treatment and are consistent with the XrayDB darwin_width API.",
      "The page computes both single-bounce reflectivity curves and double-bounce rocking curves, converting angular acceptance into equivalent energy resolution around the Bragg condition.",
    ],
    algorithmSteps: [
      "Solve Bragg condition for crystal reflection (hkl) and photon energy.",
      "Compute single-bounce Darwin curve and its FWHM in angle (theta_fwhm).",
      "Convolve two identical Darwin curves to produce the rocking curve FWHM (rocking_theta_fwhm).",
      "Convert angular bandwidths to energy bandwidths using the differential Bragg relation.",
    ],
    equations: [
      {
        label: "Bragg law",
        latex: String.raw`n\lambda = 2d_{hkl}\sin\theta_B`,
        variables: [
          { symbol: "d_{hkl}", description: "lattice spacing for reflection (hkl)", units: "A" },
          { symbol: "\\theta_B", description: "Bragg angle", units: "rad" },
          { symbol: "\\lambda", description: "X-ray wavelength", units: "A" },
        ],
      },
      {
        label: "Darwin reduced angle",
        latex: String.raw`\zeta=\frac{\theta-\theta_B}{\gamma_H}`,
        variables: [
          { symbol: "\\zeta", description: "normalized deviation from Bragg angle" },
          { symbol: "\\gamma_H", description: "Darwin half-width scale", units: "rad" },
        ],
      },
      {
        label: "Energy-angle relation (differential Bragg law)",
        latex: String.raw`\frac{\Delta E}{E}\approx \cot\theta_B\,\Delta\theta`,
        variables: [
          { symbol: "\\Delta E", description: "energy bandwidth", units: "eV" },
          { symbol: "\\Delta\\theta", description: "angular width", units: "rad" },
        ],
      },
    ],
    references: [REF_XRAYDB_PYTHON, REF_XRAYDB_EXAMPLES, REF_BRAGG, REF_DYNAMICAL],
    notes: [
      "Bandwidths reported here are intrinsic crystal responses and do not include source divergence or analyzer geometry errors.",
      "Crystals available: Si, Ge, and C (diamond). Forbidden reflections return no result.",
    ],
  },

  "/analyzers": {
    id: "/analyzers",
    title: "Analyzer Crystals",
    theorySummary: [
      "Analyzer selection uses emission-line energies and crystal reflection constraints from Bragg diffraction.",
      "The ranking strategy favors high Bragg angle (near backscattering, > 80 degrees) for best energy resolution, and narrow intrinsic Darwin width. Available crystals are Si and Ge with common reflections up to (620).",
    ],
    algorithmSteps: [
      "Select emission line energy from tabulated xray_lines data (auto-selects K-alpha-1 by default).",
      "Evaluate feasible reflections (hkl) for Si and Ge crystals with darwin_width API.",
      "Filter by user Bragg-angle window and sort by descending angle (backscattering first).",
      "Report angular width, energy resolution (FWHM), and relative resolution Delta-E/E for each reflection.",
    ],
    equations: [
      {
        label: "Reflection feasibility",
        latex: String.raw`\sin\theta_B = \frac{n\lambda}{2d_{hkl}}`,
        variables: [
          { symbol: "\\theta_B", description: "Bragg angle (must be < 90 degrees for physical reflection)" },
          { symbol: "d_{hkl}", description: "crystal lattice spacing for Miller indices (hkl)", units: "A" },
        ],
      },
      {
        label: "Energy resolution estimate",
        latex: String.raw`\Delta E \approx E\cot\theta_B\,\Delta\theta_D`,
        variables: [
          { symbol: "\\Delta\\theta_D", description: "Darwin angular width (FWHM)", units: "rad" },
          { symbol: "\\Delta E", description: "intrinsic energy resolution", units: "eV" },
        ],
      },
    ],
    references: [REF_BRAGG, REF_DYNAMICAL, REF_XRAYDB_PYTHON],
    notes: [
      "Final analyzer choice should still include instrument geometry, Johann error, and detector acceptance.",
      "Reflections with Bragg angle > 80 degrees are highlighted as near-backscattering candidates (best resolution).",
    ],
  },

  "/sample-weight": {
    id: "/sample-weight",
    title: "Sample Weight Calculator",
    theorySummary: [
      "Sample/diluent masses are solved from linear attenuation edge-step mixing at fixed pellet mass and illuminated area.",
      "This mirrors standard transmission-pellet planning where the desired edge step (Delta-mu * t) is specified and mass loading is solved algebraically. Edge-step coefficients are computed from finite differences in mass attenuation +/- 10 eV around the selected edge.",
    ],
    algorithmSteps: [
      "Compute sample and diluent edge-step coefficients by evaluating mass attenuation +/- 10 eV from the chosen edge.",
      "Solve the 2x2 system of mass-balance and target-edge-step equations for sample and diluent masses.",
      "Compute resulting transmission metrics (mu*t) above and below edge.",
      "Report physically invalid cases (negative masses) and warn when total absorption exceeds 4.",
    ],
    equations: [
      {
        label: "Target edge-step equation",
        latex: String.raw`\Delta\mu_{\mathrm{target}} = \Delta\mu_s\frac{m_s}{A}+\Delta\mu_d\frac{m_d}{A}`,
        variables: [
          { symbol: "\\Delta\\mu_s", description: "sample edge-step coefficient (mu_above - mu_below)", units: "cm^2/g" },
          { symbol: "\\Delta\\mu_d", description: "diluent edge-step coefficient", units: "cm^2/g" },
          { symbol: "A", description: "illuminated pellet area (adjusted for beam angle)", units: "cm^2" },
        ],
      },
      {
        label: "Mass conservation",
        latex: String.raw`m_s + m_d = m_{\mathrm{tot}}`,
      },
      {
        label: "Closed-form sample mass",
        latex: String.raw`m_s = \frac{\Delta\mu_{\mathrm{target}}\,A - \Delta\mu_d\, m_{\mathrm{tot}}}{\Delta\mu_s-\Delta\mu_d}`,
      },
      {
        label: "Transmission check",
        latex: String.raw`T=\exp\!\left[-\left(\frac{\mu}{\rho}\right)\frac{m}{A}\right]`,
        variables: [
          { symbol: "T", description: "transmitted intensity fraction" },
          { symbol: "m/A", description: "mass loading (areal density)", units: "g/cm^2" },
        ],
      },
    ],
    references: [REF_ELAM, REF_NIST_ATTEN, REF_BUNKER, REF_XRAYDB_EXAMPLES],
    notes: [
      "Transmission suitability is evaluated jointly from edge step and total above-edge absorption.",
      "Effective illuminated area is cos(angle)-corrected from the pellet diameter and beam incidence angle.",
    ],
  },

  "/self-absorption": {
    id: "/self-absorption",
    title: "Self Absorption",
    theorySummary: [
      "This page evaluates fluorescence EXAFS self-absorption using the exact Ameyanagi suppression ratio R(E,chi) and Booth reference traces.",
      "Computation is fully numerical on the energy grid and retains full exponential expressions (no thin/thick asymptotic approximation in the exact branch). The Booth algorithm classifies samples as thick (effective path >= 90 um) or thin and applies the appropriate formula.",
    ],
    algorithmSteps: [
      "Compute mu terms: total compound attenuation, absorber-only contribution, and effective fluorescence attenuation (intensity-weighted over emission lines).",
      "Construct geometric factors g = sin(phi)/sin(theta) and path beta = d/sin(phi) from incidence/exit angles and thickness.",
      "Evaluate exact Ameyanagi suppression ratio R(E,chi) = chi_measured/chi_true point-by-point on the energy grid.",
      "Optionally compute Booth reference traces for comparison. Summarize min/mean/max retained signal.",
    ],
    equations: [
      {
        label: "Geometry factors",
        latex: String.raw`g=\frac{\sin\phi}{\sin\theta},\qquad \beta=\frac{d}{\sin\phi}`,
        variables: [
          { symbol: "\\phi", description: "incidence angle (beam to surface)", units: "rad" },
          { symbol: "\\theta", description: "exit angle (detector to surface)", units: "rad" },
          { symbol: "d", description: "sample thickness", units: "cm" },
          { symbol: "g", description: "geometry ratio (path lengths)" },
          { symbol: "\\beta", description: "effective path through sample", units: "cm" },
        ],
      },
      {
        label: "Attenuation terms",
        latex: String.raw`\alpha(E)=\bar\mu_T(E)+g\,\mu_f,\qquad A(E,\chi)=\alpha(E)+\bar\mu_a(E)(1+\chi)`,
        variables: [
          { symbol: "\\bar\\mu_T", description: "total linear attenuation of compound (without absorber edge step)", units: "1/cm" },
          { symbol: "\\mu_f", description: "effective fluorescence attenuation coefficient", units: "1/cm" },
          { symbol: "\\bar\\mu_a", description: "absorber-only linear attenuation", units: "1/cm" },
          { symbol: "\\chi", description: "assumed EXAFS oscillation amplitude" },
        ],
      },
      {
        label: "Exact suppression ratio (Ameyanagi)",
        latex: String.raw`R(E,\chi)=\frac{1}{\chi}\left[\frac{\alpha\left(1-e^{-A\beta}\right)}{A\left(1-e^{-\alpha\beta}\right)}\cdot\frac{\alpha(1+\chi)}{\alpha+\bar\mu_a}-1\right]`,
        variables: [
          { symbol: "R", description: "suppression ratio; R=1 means no self-absorption, R<1 means signal loss" },
        ],
      },
      {
        label: "Booth thick-sample formula",
        latex: String.raw`R_{\mathrm{thick}} = \frac{1-s}{1+s\chi},\qquad s = \frac{\bar\mu_a}{\alpha+\bar\mu_a}`,
        variables: [
          { symbol: "s", description: "self-absorption parameter (fraction of absorption from target edge)" },
        ],
      },
    ],
    references: [REF_AMEYANAGI, REF_BOOTH, REF_TROGER, REF_REHR, REF_XRAYDB_EXAMPLES],
    notes: [
      "UI angles are entered in degrees and converted to radians internally.",
      "Displayed retained signal is 100 * R(E, chi) in percent.",
      "Booth thick/thin classification uses effective path length (thickness / sin(theta_incident)) with a 90 um threshold.",
      "Pellet thickness can be entered directly or computed from pellet mass, diameter, and density: d = m / (rho * pi * (D/2)^2).",
    ],
  },

  "/sample-preparation-helper": {
    id: "/sample-preparation-helper",
    title: "Sample Preparation Helper",
    theorySummary: [
      "This helper combines transmission planning (sample weight) and fluorescence self-absorption planning into a single workflow, using the same attenuation engine and exact Ameyanagi suppression calculation as the dedicated tools.",
      "For transmission mode, sample and diluent masses are solved from a 2x2 linear system of mass balance and target edge-step equations, identical to the Sample Weight calculator. Edge-step coefficients are computed from finite differences in mass attenuation +/- 10 eV around the selected absorption edge.",
      "For fluorescence mode, the exact Ameyanagi suppression ratio R(E,chi) is evaluated point-by-point on the energy grid. The computation retains full exponential expressions without thin/thick asymptotic approximations. The Booth algorithm classifies samples as thick (effective path >= 90 um) or thin and applies the appropriate formula for reference comparison.",
      "The helper evaluates five scenarios under fixed pellet geometry: pure sample, user-specified target dilution, suggested optimal dilution, fluorescence-optimized dilution, and fluorescence-optimized thickness.",
    ],
    algorithmSteps: [
      "Build mass attenuation coefficients for sample and diluent around the selected absorption edge (+/- 10 eV) and across the energy range.",
      "Solve candidate mass splits for each scenario using the closed-form equation: m_s = (Delta-mu_target * A - Delta-mu_d * m_tot) / (Delta-mu_s - Delta-mu_d).",
      "Compute transmission metrics (mu*t above and below edge) and verify edge step and absorption thresholds.",
      "Construct geometric factors g = sin(phi)/sin(theta) and path beta = d/sin(phi) from incidence/exit angles and pellet thickness.",
      "Compute mu terms: total compound attenuation, absorber-only contribution, and effective fluorescence attenuation (intensity-weighted over emission lines).",
      "Evaluate exact Ameyanagi suppression ratio R(E,chi) for each physically valid case to determine fluorescence self-absorption severity.",
      "Classify each case against transmission (0.2 <= edge step <= 2.0, mu*t <= 4.0) and fluorescence (R_min >= 90%) thresholds; rank and display best feasible options.",
    ],
    equations: [
      {
        label: "Edge-step mixing model (sample weight)",
        latex: String.raw`\Delta\mu_{\mathrm{mix}}=\Delta\mu_s\frac{m_s}{A}+\Delta\mu_d\frac{m_d}{A},\quad m_s+m_d=m_{\mathrm{tot}}`,
        variables: [
          { symbol: "\\Delta\\mu_s", description: "sample edge-step per unit mass loading", units: "cm^2/g" },
          { symbol: "\\Delta\\mu_d", description: "diluent edge-step per unit mass loading", units: "cm^2/g" },
          { symbol: "m_s, m_d", description: "sample and diluent masses", units: "g" },
          { symbol: "A", description: "illuminated pellet area", units: "cm^2" },
        ],
      },
      {
        label: "Closed-form sample mass",
        latex: String.raw`m_s = \frac{\Delta\mu_{\mathrm{target}}\,A - \Delta\mu_d\, m_{\mathrm{tot}}}{\Delta\mu_s-\Delta\mu_d}`,
      },
      {
        label: "Transmission check",
        latex: String.raw`T=\exp\!\left[-\left(\frac{\mu}{\rho}\right)\frac{m}{A}\right]`,
        variables: [
          { symbol: "T", description: "transmitted intensity fraction" },
          { symbol: "m/A", description: "mass loading (areal density)", units: "g/cm^2" },
        ],
      },
      {
        label: "Pellet thickness from mass",
        latex: String.raw`d = \frac{m_{\mathrm{tot}}}{\rho\,\pi\left(\frac{D}{2}\right)^2}`,
        variables: [
          { symbol: "D", description: "pellet diameter", units: "cm" },
          { symbol: "\\rho", description: "effective pellet density", units: "g/cm^3" },
        ],
      },
      {
        label: "Geometry factors (self-absorption)",
        latex: String.raw`g=\frac{\sin\phi}{\sin\theta},\qquad \beta=\frac{d}{\sin\phi}`,
        variables: [
          { symbol: "\\phi", description: "incidence angle (beam to surface)", units: "rad" },
          { symbol: "\\theta", description: "exit angle (detector to surface)", units: "rad" },
          { symbol: "d", description: "sample thickness", units: "cm" },
          { symbol: "g", description: "geometry ratio (path lengths)" },
          { symbol: "\\beta", description: "effective path through sample", units: "cm" },
        ],
      },
      {
        label: "Attenuation terms",
        latex: String.raw`\alpha(E)=\bar\mu_T(E)+g\,\mu_f,\qquad A(E,\chi)=\alpha(E)+\bar\mu_a(E)(1+\chi)`,
        variables: [
          { symbol: "\\bar\\mu_T", description: "total linear attenuation of compound (without absorber edge step)", units: "1/cm" },
          { symbol: "\\mu_f", description: "effective fluorescence attenuation coefficient", units: "1/cm" },
          { symbol: "\\bar\\mu_a", description: "absorber-only linear attenuation", units: "1/cm" },
          { symbol: "\\chi", description: "assumed EXAFS oscillation amplitude" },
        ],
      },
      {
        label: "Exact suppression ratio (Ameyanagi)",
        latex: String.raw`R(E,\chi)=\frac{1}{\chi}\left[\frac{\alpha\left(1-e^{-A\beta}\right)}{A\left(1-e^{-\alpha\beta}\right)}\cdot\frac{\alpha(1+\chi)}{\alpha+\bar\mu_a}-1\right]`,
        variables: [
          { symbol: "R", description: "suppression ratio; R=1 means no self-absorption, R<1 means signal loss" },
        ],
      },
      {
        label: "Booth thick-sample formula",
        latex: String.raw`R_{\mathrm{thick}} = \frac{1-s}{1+s\chi},\qquad s = \frac{\bar\mu_a}{\alpha+\bar\mu_a}`,
        variables: [
          { symbol: "s", description: "self-absorption parameter (fraction of absorption from target edge)" },
        ],
      },
      {
        label: "Suppression objective",
        latex: String.raw`R_{\min}(\chi)=\min_E R(E,\chi)`,
        variables: [
          { symbol: "R_{\\min}", description: "worst-case (minimum) retained signal across the energy range" },
        ],
      },
      {
        label: "Decision thresholds",
        latex: String.raw`0.2\le\Delta\mu t\le2.0,\quad \mu t_{\mathrm{above}}\le4.0,\quad R_{\min}\ge 90\%`,
        variables: [
          { symbol: "\\Delta\\mu t", description: "edge step (standard range for good signal-to-noise)" },
          { symbol: "\\mu t_{\\mathrm{above}}", description: "total absorption above edge (must be small enough for transmission)" },
          { symbol: "R_{\\min}", description: "minimum retained fluorescence signal (90% = negligible self-absorption)" },
        ],
      },
    ],
    references: [REF_ELAM, REF_AMEYANAGI, REF_BOOTH, REF_TROGER, REF_BUNKER, REF_XRAYDB_EXAMPLES],
    notes: [
      "Edge-step coefficients use +/- 10 eV finite differences around the selected absorption edge, matching the Sample Weight calculator.",
      "When a target edge step is infeasible under non-negative mass constraints, the helper reports the reachable range instead of forcing an invalid solution.",
      "Booth thick/thin classification uses effective path length (thickness / sin(theta_incident)) with a 90 um threshold.",
      "For fluorescence-thickness mode, if the input sample-only case already satisfies R_min >= 90%, the input mass/thickness is kept.",
      "The edge-step threshold (0.2-2.0) follows standard XAS practice for transmission experiments (Bunker, 2010). The mu*t <= 4.0 threshold ensures adequate transmitted intensity.",
      "UI angles are entered in degrees and converted to radians internally. Displayed retained signal is 100 * R(E, chi) in percent.",
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
