# Portable case contract, v1

`positano.investigation.v1` is a small interchange format for bounded snapshots. It does not assert completeness or establish an identity behind an address.

Root fields: `schema`, `network` (`eth` or `sol`), `synthetic` (boolean), `coverage` (fixed adapter disclosure), `nodes` (array), `edges` (array), `digest` (SHA-256).

Nodes: `id`, `network`, `kind` (`address`, `mint`, or `fee_payer`). IDs are canonical chain identifiers; they are not entity labels.

Edges: `id` (transaction hash/signature), `from`, `to`, `kind`, `amount` (decimal string), `unit`, `timestamp` (Unix seconds or null), `source` (explorer reference reconstructed by the adapter).

Ethereum `reported_native_transfer` means a supplied GraphSense snapshot reports native value from one address to another. It does not independently establish successful execution. Internal calls, token events, contract creation, and arbitrary networks are rejected by this adapter. Each transaction hash appears once.

Solana `token_gain_observation` means the source sampler attributed a positive token delta to a fee payer. The `from` field is the mint observation anchor, **not a token sender**. This relationship is not a transfer, a proven purchase, a bundle, or an ownership cluster. Multiple fee-payer observations can reference the same transaction; the pair (signature, fee payer) is unique. Outflow heuristics and arbitrary incoming diagnostic prose/URLs are deliberately not propagated. Coverage is bounded to supplied positive deltas and excludes creation allocations in the current source sampler.

Digest: remove `digest`; serialize with Python `json.dumps(case, sort_keys=True, separators=(',', ':'), ensure_ascii=True)`; hash the UTF-8 bytes with SHA-256; prefix with `sha256:`. This is a content checksum, not a signature, chain proof, or authentication mechanism.

CLI adapter inputs are limited to 2 MB and 500 records. Offline adapters make no network requests; the separate `collect.py` command makes four explicit read-only RPC calls. Unknown extra adapter input fields are ignored; recognized evidence fields are validated and projected into the output. Portable browser imports reject unknown fields, invalid links/identifiers, duplicate or dangling records, inconsistent receipt arithmetic, and mismatching checksums. Files are limited to 2 MB, 1,000 nodes, and 500 records. Browser checksum verification requires HTTPS or localhost. A checksum is not source authentication.

Browser v0.2 supports local case imports in memory, filters, timeline selection, and full-case text reports. Reports and JSON downloads include the full case, irrespective of active filters. Dates use inclusive UTC calendar days; records without timestamps are excluded when date filters are active. The graph is bounded to 24 nodes and 40 matching connections; the timeline still includes every matching record. Do not publish private case data. This is a bounded graph viewer, not a large-graph engine.

Optional `receipt` is an Ethereum single-transaction summary: `status`, `requestedValueWei`, `gasUsed`, `effectiveGasPriceWei`, `executionFeeWei`, `blobFeeWei`, `totalFeeWei`, `blockNumber`, `blockHash`, `transactionIndex`. Quantities are decimal strings except the index (integer); the block hash is a canonical hex hash. `executionFeeWei = gasUsed * effectiveGasPriceWei`; `totalFeeWei = executionFeeWei + blobFeeWei`. Blob fee is zero if both blob fields are absent, otherwise both are required.

RPC relationship kinds: `rpc_value_transfer` (successful, positive top-level value), `rpc_call` (successful, zero top-level value), `rpc_failed_call` (failed, transferred `amount` is zero; requested value retained separately). These are provider-reported, internally cross-checked fields, not cryptographic execution verification. Contract creation and pre-status receipts are unsupported. Internal calls, decoded events, full-wallet history, and finality are excluded. Native GraphSense export rejects failed and zero-value calls rather than portraying them as value transfers.

GraphSense `.gs` export uses the ETH nodes and transaction references only. It is a native layout file with annotations/references; the portable JSON remains the accompanying evidence record. Solana export to `.gs` is explicitly rejected.
