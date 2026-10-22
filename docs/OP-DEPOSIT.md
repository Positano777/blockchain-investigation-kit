# Ethereum to OP Mainnet: the first cross-network connector

This connector links one Ethereum Portal event to its deterministically derived Optimism deposit transaction. It supports **chain 1 → chain 10, Portal event version 0, non-creation deposits**. It does not crawl wallets, decode token transfers, trace withdrawals, or infer owners. This is not a generic connector for every OP Stack network.

## Reproduce the saved real case

Node 22+, no npm install:

```sh
node bridge.mjs build examples/op-deposit.mainnet.json reproduced-bridge-case.json
python -m http.server 8080 --directory web --bind 127.0.0.1
```

Open `http://127.0.0.1:8080` and use **Open local case** for the output, or select the bundled Ethereum → Optimism example. Output paths must be new. The supplied evidence reproduces `web/bridge-case.json` and its checksum offline.

The real captured pair:

- [Ethereum transaction](https://etherscan.io/tx/0x72a93abb719dc48848047b13e81d539b8dca165d77a568d05ccc40a2b61dd63a), global log index **196**.
- [Derived Optimism transaction](https://optimistic.etherscan.io/tx/0x1280b561a1ba4e1c7c0294c92f884056ac89f77bb2d28f4e2030a689d45b98e1).
- Deposit `sourceHash`: `0xe11475e38d0bc83067a059abde80f9f636c49bc665bca90bee002699cac4b3c3`.
- Event mint and requested L2 value: **4.023132372820432805 ETH** each.
- Destination receipt reports success. This is not a net wallet balance or proof of later asset disposition.

Ethereum responses were captured from `https://ethereum.publicnode.com`; Optimism responses from the registry-listed `https://mainnet.optimism.io`. Only projected public transaction, receipt, selected log, and block fields are retained. No endpoint credentials are stored. The original Ethereum hash was located through a public explorer listing; explorer labels are not used to establish the link or assign an identity.

## What establishes the connection

The event must come from the pinned OP Mainnet Portal address and have the expected `TransactionDeposited` signature, supported version, and consistent transaction/block/log references. The event yields the L2 sender (possibly already aliased), recipient, mint, call value, gas, and calldata.

The implementation follows the OP deposit specification to calculate the deposit source hash from the Ethereum block hash and **global block log index**. It encodes the typed deposit transaction and computes its Keccak hash. The destination RPC transaction must match that derived hash and its decoded deposit fields, including type, source hash, sender, target, mint, value, gas, and calldata. Receipt/block inclusion references and execution status are checked separately.

The UI uses internal chain-qualified transaction IDs, with explicit chain IDs 1 and 10. The graph represents a **deposit derivation/execution link**, not an inferred transfer between address owners. These internal IDs are not CAIP-10 account identifiers.

## Capture another supported deposit

Set `ETH_RPC_URL` and `OP_RPC_URL` in your shell to HTTPS endpoints for chains 1 and 10. Then:

```sh
python capture_bridge.py ETHEREUM_TRANSACTION_HASH new-bundle.json
node bridge.mjs build new-bundle.json new-case.json
```

If a transaction contains several Portal events, select one with `--log-index GLOBAL_LOG_INDEX`. The collector uses the existing four read-only RPC methods on each network. It derives the destination hash before requesting the L2 transaction, validates the pair before writing, rejects redirects, bounds response/file sizes, and never signs or submits anything. It does not scan for unrelated transactions. If the destination is unavailable or pending, capture fails; absence is not classified as a failed or lost deposit.

## Limits and trust

- The L2 hash is mathematically recomputed from **supplied** L1 log data. This authenticates neither the supplied L1 event nor the claimed L2 inclusion. No receipt-trie proof, block-header consensus verification, independent-provider agreement, or finality check is implemented.
- A case checksum detects changed content; anyone can fabricate a self-consistent unsigned case. It is not a trusted attestation.
- A failed destination call does not undo the protocol mint. The case preserves mint and requested value separately and reports zero successful top-level call delivery on failure.
- Internal calls, emitted token events, later transfers, contract-creation deposits, other event versions, other portals/chains, and withdrawals are excluded. Bridge cases currently stand alone; the Ethereum receipt assembler does not merge them.
- The browser recomputes the derivation before accepting a local case and constructs explorer links from checked hashes. Imports remain browser-local.

## Foundations and attribution

- [OP deposit specification](https://specs.optimism.io/protocol/deposits.html).
- OP reference decoder and source-hash implementation reviewed at revision [`13ce36ceda571121f8ee7d563b6008270361f2a8`](https://github.com/ethereum-optimism/optimism/tree/13ce36ceda571121f8ee7d563b6008270361f2a8/op-node/rollup/derive): `deposit_log.go`, `deposit_source.go`.
- [Official Superchain registry configuration](https://github.com/ethereum-optimism/superchain-registry/blob/009155d5f96df7fe564fd37e2751d9dd0480e0ed/superchain/configs/mainnet/op.toml), pinned revision `009155d5f96df7fe564fd37e2751d9dd0480e0ed`, supplies the chain ID, Portal proxy address, and public OP RPC.
- Keccak uses **@noble/hashes 1.8.0**, MIT, four reviewed ESM files. The bare crypto import is changed to a local module path; license, original/adapted file checksums, npm tarball integrity, and modifications are recorded in `web/vendor/noble-hashes/PROVENANCE.json`. The registry archive integrity and upstream file hashes were checked. No package installation was performed. The GraphSense codec remains unchanged.
