# Portable case contract, v1

`positano.investigation.v1` is a small interchange format for bounded snapshots. It does not assert completeness or establish an identity behind an address.

Root fields: `schema`, `network` (`eth` or `sol`), `synthetic` (boolean), `coverage` (fixed adapter disclosure), `nodes` (array), `edges` (array), `digest` (SHA-256).

Nodes: `id`, `network`, `kind` (`address`, `mint`, or `fee_payer`). IDs are canonical chain identifiers; they are not entity labels.

Edges: `id` (transaction hash/signature), `from`, `to`, `kind`, `amount` (decimal string), `unit`, `timestamp` (Unix seconds or null), `source` (explorer reference reconstructed by the adapter).

Ethereum `reported_native_transfer` means a supplied GraphSense snapshot reports native value from one address to another. It does not independently establish successful execution. Internal calls, token events, contract creation, and arbitrary networks are rejected by this adapter. Each transaction hash appears once.

Solana `token_gain_observation` means the source sampler attributed a positive token delta to a fee payer. The `from` field is the mint observation anchor, **not a token sender**. This relationship is not a transfer, a proven purchase, a bundle, or an ownership cluster. Multiple fee-payer observations can reference the same transaction; the pair (signature, fee payer) is unique. Outflow heuristics and arbitrary incoming diagnostic prose/URLs are deliberately not propagated. Coverage is bounded to supplied positive deltas and excludes creation allocations in the current source sampler.

Digest: remove `digest`; serialize with Python `json.dumps(case, sort_keys=True, separators=(',', ':'), ensure_ascii=True)`; hash the UTF-8 bytes with SHA-256; prefix with `sha256:`. This is a content checksum, not a signature, chain proof, or authentication mechanism.

CLI inputs are limited to 2 MB and 500 records. No network requests are made. Unknown extra input fields are ignored; recognized evidence fields are validated and projected into the output. Browser v0.1 displays bundled cases only. To inspect an adapter output locally, place it as `web/eth-case.json` or `web/sol-case.json` in your own checkout. Do not publish private case data. The viewer is a bounded demo layout intended for these small examples, not a general large-graph engine.

GraphSense `.gs` export uses the ETH nodes and transaction references only. It is a native layout file with annotations/references; the portable JSON remains the accompanying evidence record. Solana export to `.gs` is explicitly rejected.
