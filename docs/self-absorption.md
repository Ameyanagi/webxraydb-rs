# Self-Absorption Correction for Fluorescence EXAFS

## Reference

C.H. Booth, F. Bridges, "Improved self-absorption correction for fluorescence measurements of extended x-ray absorption fine-structure," *Physica Scripta* **T115**, 202–204 (2005).

## The Problem

In fluorescence-mode EXAFS, the measured signal is attenuated because both the incident beam and the fluorescence photon are absorbed by the sample. For concentrated samples, this **self-absorption** effect significantly damps the EXAFS amplitude:

$$\chi_\text{exp} < \chi_\text{true}$$

The severity depends on the absorber concentration, matrix composition, measurement geometry, and sample thickness.

## Geometry

```
         incident beam (I₀)
              ↓  φ
    ─────────────────────── sample surface
              ·  ·  ·
              ·  ·  ·  fluorescence (I_f) → θ
              ·  ·  ·
    ─────────── d ──────── (sample thickness)
```

| Symbol | Definition |
|--------|------------|
| $\phi$ | Incident angle (to sample surface) |
| $\theta$ | Fluorescence exit angle (to sample surface) |
| $d$ | Sample thickness |
| $g = \sin\phi / \sin\theta$ | Geometry ratio (default: $g = 1$ for 45°/45°) |

## Definitions

All $\mu$ values below are **linear absorption coefficients** (cm⁻¹) = mass absorption coefficient × density. In our implementation, stoichiometry-weighted mass coefficients from the Elam database are used, and density is applied when needed for absolute calculations.

| Symbol | Definition |
|--------|------------|
| $\mu_a(E)$ | Absorption of the central (absorbing) element at energy $E$ |
| $\bar{\mu}_a$ | Smooth (non-oscillatory) part of $\mu_a$; the edge-jump contribution obtained by subtracting $\mu_a(E_\text{edge} - 200\,\text{eV})$ |
| $\mu_T(E)$ | Total absorption of all elements at energy $E$ |
| $\bar{\mu}_T$ | Smooth part of $\mu_T$ (from tabulated cross-sections) |
| $\mu_f$ | Total absorption of all elements at the fluorescence energy $E_f$ |
| $\alpha$ | $= \bar{\mu}_T + g \cdot \mu_f$ — effective absorption including geometry |
| $s$ | $= \bar{\mu}_a / \alpha$ — self-absorption fraction (0 = no effect, 1 = complete absorption) |

## Fluorescence Signal Expression

The fluorescence intensity from a sample of thickness $d$ is (paper Eq. 3):

$$I_f = \frac{I_0\,\varepsilon_a\,\mu_a}{\mu_T + g\,\mu_f} \left[ 1 - \exp\!\left(-\left(\frac{\mu_T}{\sin\phi} + \frac{\mu_f}{\sin\theta}\right)d\right) \right]$$

Defining $L = d / \sin\phi$ and noting that $\mu_T/\sin\phi + \mu_f/\sin\theta = \alpha/\sin\phi$ (when using the smooth background), the exponent becomes $-\alpha L$.

## Exact Relation Between True and Measured EXAFS (Paper Eq. 4)

Using $\mu_a = \bar{\mu}_a(1 + \chi)$ and $\mu_T = \bar{\mu}_T + \bar{\mu}_a\chi$:

$$\chi_\text{exp} = \frac{1 - e^{-(\alpha + \bar{\mu}_a\chi)\,L}}{1 - e^{-\alpha\,L}} \cdot \frac{\alpha(\chi + 1)}{\alpha + \bar{\mu}_a\chi} - 1$$

This expression is **exact** but implicit in $\chi$.

## Ameyanagi Exact Suppression Factor (No Inversion)

For an assumed EXAFS amplitude $\chi$ (for example, $\chi = 0.2$), define the
suppression factor:

$$
R(E,\chi) = \frac{\chi_{\mathrm{exp}}(E)}{\chi}
$$

All attenuation coefficients below are linear coefficients in cm$^{-1}$.

### Required intermediate terms

$$
g = \frac{\sin\phi}{\sin\theta}, \qquad \beta = \frac{d}{\sin\phi}
$$

$$
\alpha(E) = \bar{\mu}_T(E) + g\,\mu_f
$$

$$
A(E,\chi) = \alpha(E) + \bar{\mu}_a(E)\chi
$$

where:

- $\bar{\mu}_T(E)$ is the compound linear attenuation at incident energy $E$.
- $\bar{\mu}_a(E)$ is the absorber linear attenuation contribution:
  $\rho\,w_a\,(\mu/\rho)_a(E)$.
- $\mu_f$ is fluorescence-weighted compound attenuation:
  $\mu_f = \sum_j w_j\,\mu(E_{f,j})$ with normalized emission weights
  $\sum_j w_j = 1$.

### Exact equation to implement

$$
\boxed{
R(E,\chi)
=
\frac{1}{\chi}
\left[
\frac{
\left(1 - e^{-A(E,\chi)\beta}\right)
}{
\left(1 - e^{-\alpha(E)\beta}\right)
}
\cdot
\frac{
\alpha(E)(1+\chi)
}{
A(E,\chi)
}
-1
\right]
}
$$

This must be evaluated directly (no series expansion, no inversion solver).

## Correction Formula

### Thick Limit ($d \to \infty$)

When $e^{-\alpha L} \to 0$, the expression simplifies to (paper Eq. 6):

$$\boxed{\chi = \frac{\chi_\text{exp}}{1 - s(\chi_\text{exp} + 1)}}$$

where $s = \bar{\mu}_a / \alpha$.

**Implementation** (`correct_thick`):
```rust
chi_corr = chi_exp / (1.0 - s * (chi_exp + 1.0))
```

### General Case — Finite Thickness (Paper Eq. 5)

Using a first-order expansion of $e^{-\bar{\mu}_a\chi L}$ in the exact expression yields a quadratic equation in $\chi$. Define:

$$\eta = \alpha \cdot L = \frac{\alpha \cdot d}{\sin\phi}$$

$$\beta = 1 - e^{-\eta} \qquad \text{(paper's } \beta\text{)}$$

$$\gamma = \frac{\bar{\mu}_a \cdot d}{\alpha \cdot \sin\phi} \cdot e^{-\eta} = \frac{\bar{\mu}_a}{\alpha} \cdot \frac{\eta}{\alpha} \cdot e^{-\eta} \qquad \text{(paper's } \gamma\text{)}$$

The correction (paper Eq. 5, quadratic formula):

$$\boxed{\chi = \frac{-\left[\beta(\alpha - \bar{\mu}_a(\chi_\text{exp}+1)) + \gamma\right] + \sqrt{\left[\beta(\alpha - \bar{\mu}_a(\chi_\text{exp}+1)) + \gamma\right]^2 + 4\alpha\gamma\beta\,\chi_\text{exp}}}{2\gamma}}$$

### Implementation Note

In the code (`correct_thin`), the variables are named differently from the paper for dimensional consistency when using linear absorption coefficients:

| Code variable | Paper variable | Expression |
|---------------|---------------|------------|
| `gamma` | $\beta$ | $1 - e^{-\eta}$ |
| `beta` | $\alpha \cdot \gamma$ | $\bar{\mu}_a \cdot \eta \cdot e^{-\eta}$ |

The code stores `alpha * gamma_paper` instead of `gamma_paper` directly, which makes all terms in the quadratic formula have consistent units of cm⁻¹. The quadratic solved is mathematically equivalent:

```rust
let eta = alpha_lin * d_cm / sin_phi;       // η = α·d/sin(φ)
let exp_neg_eta = (-eta).exp();
let beta  = mu_a_lin * exp_neg_eta * eta;   // = α · γ_paper  (cm⁻¹)
let gamma = 1.0 - exp_neg_eta;              // = β_paper       (dimensionless)

let b = gamma * (alpha_lin - mu_a_lin * (chi_exp + 1.0)) + beta;
let c = 4.0 * alpha_lin * beta * gamma * chi_exp;

chi_corr = (-b + sqrt(b*b + c)) / (2.0 * beta);
```

**Verification of limiting cases:**
- **Thin limit** ($\eta \to 0$): `beta → 0`, `gamma → 0`, and the formula reduces to $\chi = \chi_\text{exp}$ (no correction needed).
- **Thick limit** ($\eta \to \infty$): `beta → 0` (exponentially), `gamma → 1`, and via L'Hôpital the formula reduces to $\chi = \chi_\text{exp} / (1 - s(\chi_\text{exp}+1))$.

### Thick/Thin Determination

The effective path through the sample is $d / \sin\phi$. If this exceeds 90 μm, the thick-limit formula is used.

## Signal Retained (UI Display)

The "signal retained" plot shows the fraction of true EXAFS amplitude that survives self-absorption, using the thick-limit approximation:

$$\text{signal retained} = (1 - s) \times 100\%$$

where $s = \bar{\mu}_a / \alpha$. This represents the **worst case** (infinite thickness). For thin samples, the actual self-absorption effect is smaller.

## Energy-to-k Conversion

$$k = \sqrt{0.2625 \times (E - E_0)} \quad [\text{\AA}^{-1}]$$

where $E$ is in eV and $E_0$ is the edge energy. The constant $0.2625 \approx 2m_e/\hbar^2$ in eV⁻¹Å⁻².
