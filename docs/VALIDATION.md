# v0.2 validation

- `python -m unittest discover -s tests -v`: 19 tests, including mainnet fixture reproduction, receipt mismatches, failure vs transferred value, exact fees, blob fee pairing, read-method allowlist, redacted provider errors, and original codec/provenance checks.
- `node --test tests/case.test.mjs`: 9 tests, including cross-language checksums, tampering, unsafe URLs, dangling/duplicate evidence, fee consistency, filters, and exact ETH formatting.
- Chrome browser check: real fee display; synthetic-case switching; address/date filters and empty state; local file import; tampered/oversized file rejection with existing case preserved; JSON/report downloads; no network write requests during import; 390px mobile layout without horizontal overflow; zero browser console errors.
- Live read-only check: one Ethereum mainnet transaction/receipt/block captured and converted. The saved projected response fields reproduce the portable case offline.
- Vendored codec remains pinned and unchanged. No new third-party dependencies installed.

The GitHub workflow is a documented example, not an enabled CI check. The full GraphSense backend and dashboard runtime remain untested. No malware-free claim, external security audit, chain proof, finality check, full-wallet history, or independent-provider consensus is implied by these checks.
