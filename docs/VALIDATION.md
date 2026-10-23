# Validation record

## v0.8 additions

- Python: 72 tests. Node: 54 tests. Added Solana projection/capture, exact u64 amounts, account/program validation, mint consistency, version/null-metadata rejection, bounded cursor pages, method/endpoint restrictions, shared-service persistence/session/busy checks, reconstructed outcomes/references, and Solana card labels.
- Live read-only capture: one successful top-level System transfer (1,170 lamports, 5,000-lamport fee) and a separate transaction with a classic SPL Token inner instruction. CPI outcome remains unverified. Both projected mainnet fixtures reproduce offline; failure/u64 labs are synthetic.
- Chrome: graph/outcome styling; exact large amounts/balances; failed transaction not-committed labels; saved/reopened notes; tampered import rejected while retaining prior evidence; live Solana capture persisted; two distinct five-signature account pages, cursor navigation, and manual signature selection; full report and PNG export.
- Static preview does not call local APIs and hides provider controls. Mobile 390px layout has no overflow; zero page/console errors or warnings. No packages installed. Source/provider credential diagnostics remain excluded.
- No signature verification, independent finality/consensus proof, local CPI outcome proof, full indexed history, Token-2022, swap semantics, or pump.fun lifecycle decoding is claimed.

## v0.7 additions

- Python: 59 tests. Node: 44 tests. Added Bitcoin case reconstruction/tampering checks, persisted real-schema Bitcoin jobs, HTTP field/origin restrictions, comparison disagreement cases, and card escaping/privacy checks.
- Chrome: five Bitcoin relationships and three transaction nodes rendered; selected a reported spender; saved/reopened notes; rejected a tampered import while retaining the case; completed live Bitcoin capture to a saved case; exported full evidence report and 1200 × 630 PNG.
- Chrome comparison: identical captures produce no changes; an offline constructed observation change is detected and exported with both digests. This is not a live reorganization/mempool demonstration.
- Local/static boundary: static preview does not request local APIs and keeps capture controls hidden. Bitcoin and asset demo deep links work. Desktop and 390px mobile screenshots inspected; no overflow, console errors, or warnings.
- No new packages installed. No full Solana history, pump.fun lifecycle, complete wallet history, chain consensus proof, or attribution is claimed.

## Bitcoin CLI preview additions

- Python suite: 57 tests total; existing Node suite: 34 tests. New Bitcoin checks cover exact amounts/fees, duplicate/coinbase inputs, reference/script/status mismatches, confirmation ordering, caps/network rejection, endpoint/path restrictions, projected fields, and reproduction of saved mainnet JSON and Markdown.
- Live read-only Esplora capture: one mainnet transaction plus both reported spending transactions. Reported spend references and previous outputs agree. The original captured fixture is retained for offline reproduction.
- No new packages installed; no browser changes. Bitcoin schemas remain CLI-only and are not accepted by the local case service yet.

## v0.6 additions

- Python suite: 46 tests; Node suite: 34 tests (80 total). Added persisted-case reopening, immutable evidence with separate notes, all eight schema checks, origin/Host/session protection, endpoint injection rejection, bounded jobs, concurrency limits, and redacted failures.
- Chrome: saved/reopened cases, notes isolated between views, evidence checksum unchanged after annotation, successful live five-block OP expansion, saved results surviving page reload, and 390px layout without overflow; zero console errors or warnings.
- The live expansion found zero direct-address matches. This checks successful collection and persistence, not complete wallet history. Positive/capped captures use existing offline transports.
- No new dependencies installed. SQLite data remains local and excluded from source publication. Hosted previews remain static; persistence and live jobs require `python serve.py` locally.
- Bitcoin UTXO, full Solana history, and pump.fun lifecycle remain planned connector capabilities, not implemented adapters.

## v0.5 additions

- Python suite: 36 tests total. New checks cover trace-field redaction, unavailable trace status, bounds/chain validation, fixed tracer configuration, ten-transaction scan cap, detected reorganization, and unsupported trace shapes.
- Node suite: 34 tests total. New checks cover real Transfer-shaped logs, exact raw units, NFT IDs, reverted ancestors/receipts, root deduplication, inherited DELEGATECALL/CALLCODE exclusion, SELFDESTRUCT value, source association, malformed/duplicate/removed logs, trace gaps, scan-manifest constraints, and reconstructed-case tampering.
- Chrome: bridge-target five-block command, six real supported logs and missing trace indication, two reverted internal attempts with distinct graph styling, honest zero-result scan, local import, evidence references in the exported report, and 390px layout without overflow; zero console errors.
- Live capture: a real receipt with six supported token events; its trace request was rejected (HTTP 403), so no real trace coverage is claimed. A five-block OP direct-address scan captured zero matches. Positive-match/cap/reorganization behavior is checked with offline test transports.
- No new dependencies installed. Existing pinned libraries remain unchanged. Reports and JSON retain coverage limits; no complete activity, net balance, owner identity, or exact deposited-fund attribution is inferred.

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
