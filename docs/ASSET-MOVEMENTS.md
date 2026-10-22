# Asset evidence and bounded one-hop discovery

v0.5 decodes top-level ETH value, Transfer-shaped token logs, and supplied Geth callTracer frames on Ethereum (1) or OP Mainnet (10). Every connection has a transaction/log/trace-path reference and outcome. Provider observations are not authenticated balance proofs or attributed owners.

## Reproduce offline

```sh
node assets.mjs examples/assets.mainnet.json real-assets-case.json
node assets.mjs examples/assets.synthetic.json synthetic-trace-case.json
node assets.mjs examples/after-bridge.mainnet.json after-bridge-case.json
```

Node 22+, no npm install. Open output JSON locally in the workspace. Existing paths are never overwritten; inputs/outputs are limited to 2 MB.

- The real Ethereum transaction `0x20f83f863231a8e1c97f14d1b2e9379d389c57d3bb82d265cd6e5d806378ba9b` contains six supported Transfer-shaped logs, including a burn-shaped event. Five other logs are retained but not decoded. Its trace request returned HTTP 403; trace coverage is explicitly unavailable. No real internal movements are claimed from it.
- The synthetic trace lab has fabricated identifiers and demonstrates a native movement, mint-shaped token event, NFT-shaped event, and reverted parent whose child effects are also reverted. Inherited DELEGATECALL value is not counted. It is not the real transaction's trace.
- The real post-bridge scan inspected OP blocks **150539535–150539539** for direct transactions involving `0x4ec1aabc0fb4241d582799e32b428bfabba8c13a`. Zero matching transactions were captured. This establishes neither absence of token/internal-only activity nor absence of later activity.

## Capture and expand

Set ETH_RPC_URL or OP_RPC_URL in your shell to the chain's HTTPS endpoint:

```sh
python capture_assets.py transaction 1 TRANSACTION_HASH evidence.json --trace
node assets.mjs evidence.json case.json
python capture_assets.py hop 10 ADDRESS START_BLOCK END_BLOCK hop-evidence.json
node assets.mjs hop-evidence.json hop-case.json
```

On a bridge or asset case, **Expand one hop → Prepare one-hop command** generates a local command for its call target and five subsequent blocks. It does not execute browser RPC requests, store credentials, or upload anything. It follows a selected address, not an attributed owner or specific deposited coins.

Discovery scans **1–20 explicit blocks** for matching top-level from/to addresses and captures at most **10 transactions**. At the cap it stops and reports limitReached. Token-only/internal-only address activity is not discovered, and counterparties are not recursively expanded. Detected reorganization between discovery and capture fails the operation.

The manifest records requested range and scanned block numbers/hashes. Complete discovery blocks are not embedded: offline validation checks manifest consistency and captured-record membership, not whether omitted transactions existed. Independent coverage checking requires recapture. Scan context is not an authenticated link to a bridge case.

The optional trace request uses only built-in callTracer and a five-second tracer timeout. Unsupported/unavailable/unprojectable traces remain explicit gaps. Raw errors/revert reasons are projected to failure booleans, not retained. Mismatched trace/transaction fields fail validation. Contract-creation transactions and frames without usable destination addresses are unsupported.

## Interpretation and limits

- Native top-level value appears once; failed value is an attempt. CALL/CREATE/CREATE2/SELFDESTRUCT values are provider-reported. Failed ancestors or receipts propagate failure. DELEGATECALL/CALLCODE inherited values are excluded. The trace root is not counted twice.
- Three-topic, 32-byte-data Transfer logs are ERC-20-shaped events; four-topic, empty-data logs are NFT-shaped events. Shapes do not establish contract compliance, legitimacy, or actual balances. Zero-address endpoints are labeled mint/burn events. Integer units and token IDs remain exact; decimals and symbols are not guessed. ERC-1155 and swap semantics are excluded.
- Unknown/unsupported logs are counted. Removed, duplicate, inconsistent, or failed-receipt logs are rejected. Synthetic and real examples remain separate.
- Execution fees are gasUsed times effectiveGasPrice; blob, L1 data, and operator fees are excluded from this view. Different token amounts are not aggregated.
- Limits: 1,000 frames per transaction, depth 32, 1,000 logs per receipt, 500 case connections. Larger evidence must be narrowed; decoder output is not silently truncated. The separate graph display cap remains visible.

Semantics: [Geth callTracer](https://geth.ethereum.org/docs/developers/evm-tracing/built-in-tracers), [ERC-20](https://eips.ethereum.org/EIPS/eip-20), [ERC-721](https://eips.ethereum.org/EIPS/eip-721). No new dependencies were installed. No arbitrary tracer JavaScript or transaction submission is accepted. No independent chain/finality proof, complete history, net balance, common ownership, or exact fund attribution is claimed.
