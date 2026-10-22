# v0.2 validation

## v0.3 additions

- Python suite: 25 tests total, including assembly bounds, deterministic input ordering, deduplication, retained source references, conflict rejection, and synthetic/nonsynthetic separation.
- Node suite: 12 tests total, including assembled-case checksums, per-transaction receipt validation, required source references, and block-index ordering.
- Chrome: combined-case rendering, transaction search, per-record source checksums, full provenance report export, single-receipt backward compatibility, and 390px layout without overflow; zero console errors.
- A second real mainnet receipt was captured using the existing read-only collector. No new dependencies installed.

The earlier v0.2 checks below describe the previous release; the totals above supersede those test counts.

- `python -m unittest discover -s tests -v`: 19 tests, including mainnet fixture reproduction, receipt mismatches, failure vs transferred value, exact fees, blob fee pairing, read-method allowlist, redacted provider errors, and original codec/provenance checks.
- `node --test tests/case.test.mjs`: 9 tests, including cross-language checksums, tampering, unsafe URLs, dangling/duplicate evidence, fee consistency, filters, and exact ETH formatting.
- Chrome browser check: real fee display; synthetic-case switching; address/date filters and empty state; local file import; tampered/oversized file rejection with existing case preserved; JSON/report downloads; no network write requests during import; 390px mobile layout without horizontal overflow; zero browser console errors.
- Live read-only check: one Ethereum mainnet transaction/receipt/block captured and converted. The saved projected response fields reproduce the portable case offline.
- Vendored codec remains pinned and unchanged. No new third-party dependencies installed.

The GitHub workflow is a documented example, not an enabled CI check. The full GraphSense backend and dashboard runtime remain untested. No malware-free claim, external security audit, chain proof, finality check, full-wallet history, or independent-provider consensus is implied by these checks.
