# Connector contract and capability boundaries

The service stores validated evidence cases without assuming that every chain uses Ethereum accounts. Current decoders remain explicit allowlisted modules; this document specifies future adapter boundaries, not an installed dynamic plugin system.

| Connector | State | What exists |
| --- | --- | --- |
| Ethereum / OP asset evidence | Implemented, bounded | Receipt-event and supplied call-trace decoding; direct-address block scan |
| Ethereum → OP Portal deposits | Implemented, narrow | One supported deposit version/route with deterministic destination hash |
| Solana launch observations | Implemented, offline subset | Import of existing launch-evidence observations; no full Solana history |
| Bitcoin UTXO investigations | Planned | Requires transaction input/output/outpoint capture and spend discovery |
| Solana instructions and token history | Planned | Requires program/instruction/account-aware capture and coverage |
| pump.fun lifecycle | Planned extension | Requires launch, curve, migration, liquidity, and disposal evidence; not just a token label |

Adapters must expose these responsibilities:

1. **Identify:** validate network-qualified subjects before network access. A Bitcoin outpoint is not an Ethereum address; identical-looking values on different chains must not collapse into one node.
2. **Discover:** return bounded observations with range/cursor, pagination status, caps, unsupported activity classes, and source provenance. Missing results must not become a completeness claim.
3. **Capture:** retain projected transaction/block/instruction/log/trace data as appropriate. Keep credentials, arbitrary provider diagnostics, and private endpoint URLs outside exported evidence.
4. **Decode:** preserve chain semantics. Account calls, UTXO spends, token account changes, and bridge derivations are separate relationship kinds. Preserve integer amounts and asset identifiers; avoid guessed decimals and aggregation across assets.
5. **Explain:** each relationship points to its source transaction plus log index, call path, instruction index, outpoint, or derivation inputs. Distinguish observations, consistency checks, protocol derivation, and any future independently authenticated proof.
6. **Validate:** offline reconstruction and deterministic checksums remain mandatory. A content checksum is not source authentication, chain consensus, or an ownership assertion.

The service can persist all case schemas currently accepted by the shared validator. Unknown schemas fail validation until a reviewed decoder is added. Adding a name to a capability table does not enable network collection.

Analyst annotations stay outside evidence content and are not promoted into observed facts. Future clustering/change-address/bundle heuristics must carry their assumptions and supporting references. UTXO change detection, common-input ownership, timing correlations, or shared case membership cannot silently become identity links.

New adapters need a public or explicitly synthetic fixture, negative/failure cases, declared data limits, a reproducible investigation example, license/provenance review for reused code, and a UI explanation of unsupported paths. The initial order remains usable EVM workflow, broader Solana/pump.fun evidence, then a Bitcoin UTXO connector; none of the planned rows is advertised as already working.
