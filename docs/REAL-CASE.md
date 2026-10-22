# A real transaction with zero top-level ETH value and a nonzero fee

Transaction: [0x20f83f863231a8e1c97f14d1b2e9379d389c57d3bb82d265cd6e5d806378ba9b](https://etherscan.io/tx/0x20f83f863231a8e1c97f14d1b2e9379d389c57d3bb82d265cd6e5d806378ba9b).

The transaction was selected as the first transaction returned for Ethereum mainnet block 21,000,000. No identity, risk, or criminal-activity claim is made about its addresses.

The capture in `examples/eth-receipt.mainnet.json` was read from the public `https://ethereum.publicnode.com` endpoint. It contains projected RPC transaction, receipt, and block fields, plus the capture timestamp. Endpoint credentials and provider diagnostics are never part of the bundle. This is one provider's capture; no independent-provider agreement, block proof, or finality verification is claimed.

Receipt-reported findings:

- Block: 21,000,000, transaction index 0.
- Status: success.
- Top-level ETH value: 0 wei. This does not imply that no assets moved through internal calls or token events.
- Gas used: 202,746.
- Effective gas price: 51,769,454,205 wei.
- Execution fee: `202746 * 51769454205 = 10496049762246930` wei, or **0.01049604976224693 ETH**.
- No blob fee fields were supplied; the adapter adds zero blob fee.

The useful distinction: **a successful zero-value call still pays gas**. The viewer shows a call and its receipt fee rather than inventing an ETH transfer. Token events and internal transfers are outside this release's coverage.

Reproduce offline, without an API key:

```sh
python kit.py rpc examples/eth-receipt.mainnet.json reproduced-case.json
```

The result matches `web/real-case.json`, including its deterministic checksum. The test suite checks this. A matching checksum establishes reproducibility of these supplied fields, not their authenticity.

Recapture with your HTTPS mainnet provider using the README command and compare the actual fields. A different capture timestamp is expected and is excluded from the portable case; changed mined block/status fields warrant investigation. No automated multi-provider consensus is implemented.

API semantics follow [Ethereum's JSON-RPC specification](https://ethereum.org/developers/docs/apis/json-rpc/).

## Multi-transaction example

The v0.3 example adds transaction [0x12f2db8aa47b9588a34807d282c939dd21ee4eab10e135817661a1f2b1f809c1](https://etherscan.io/tx/0x12f2db8aa47b9588a34807d282c939dd21ee4eab10e135817661a1f2b1f809c1), at index 1 of the same block. Its captured bundle is `examples/eth-receipt-second.mainnet.json`.

```sh
python assemble.py combined-case.json examples/eth-receipt.mainnet.json examples/eth-receipt-second.mainnet.json
```

This reproduces `web/multi-case.json` with two transactions, four distinct supplied addresses, individual receipt summaries, and input-bundle checksum references. The browser's default example displays it. No direct relationship, common owner, or flow of funds is asserted between these two transactions. They were selected by adjacent block index as an interoperability example, not as an investigation finding.
