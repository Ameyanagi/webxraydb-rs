//! Self-absorption correction for fluorescence XAS.
//!
//! Implements 4 algorithms as found in Athena/Demeter:
//!
//! - **Fluo** (Haskel, Ravel, Stern) — corrects μ(E), applicable to XANES
//! - **Troger** (Tröger et al., PRB 46:6, 1992, 3283) — simple χ(k) correction
//! - **Booth** (Booth & Bridges, Phys. Scr. T115, 2005, 202) — handles thin & thick samples
//! - **Atoms** (Ravel, J. Synch. Rad. 8:2, 2001, 314) — amplitude + σ² correction

mod common;

pub mod atoms;
pub mod booth;
pub mod fluo;
pub mod troger;

pub use common::{FluorescenceGeometry, SelfAbsError, ETOK};
