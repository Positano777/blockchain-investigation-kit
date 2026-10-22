# Validation record

## v0.4 additions

- Python suite: 29 tests total, including read-only capture of each chain, chain-ID rejection, provider-field projection, and bounded source logs.
- Node suite: 24 tests total, including Keccak/RLP vectors, deterministic real L2 hash derivation, field/inclusion consistency, wrong-chain/portal/version rejection, global log-index identity, malformed ABI, failed destination semantics, derived-metadata tampering, and Noble file provenance hashes.
- Chrome: actual cross-network case rendered; destination search and explorer links; inspectable derivation identifiers; local import without network requests; source-hash mismatch rejected while retaining the prior case; text and full evidence JSON downloads; old multi-receipt and Solana cases; 390px layout without overflow; zero console errors.
- Live read-only capture: one Ethereum Portal deposit and its exact derived Optimism transaction/receipt/block were fetched, then reproduced offline.
- Four Noble 1.8.0 ESM modules were vendored with MIT license and one documented local import adjustment. Their upstream module hashes match the npm package archive, whose SHA-512 integrity matches the recorded package-lock entry. No npm install or lifecycle hooks were run. These checks are not an external security audit or malware-free guarantee.

No receipt-trie/block consensus proof, finality check, wallet-history completeness, token-flow decoding, or ownership attribution is claimed. The connector is restricted to one supported Ethereum → OP Mainnet Portal deposit, rather than general cross-chain tracing.

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
