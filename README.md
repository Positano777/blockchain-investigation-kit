# Positano Investigations

An open-source starting point for portable blockchain investigations: inspect a graph, follow its source transactions, and export evidence for other tools.

**v0.3 prototype.** Assemble multiple receipt bundles into one investigation, open it locally, search addresses and transactions, filter the timeline, inspect each receipt and source checksum, and export a portable report. Includes two captured real Ethereum receipts and explicitly synthetic graph examples. This is a bounded investigation workspace, not a full blockchain indexer or a production forensic platform.

![Investigation workspace showing a real Ethereum receipt and exact fee breakdown](docs/screenshots/workspace.png)

## Run locally

Python 3.11+; no pip installs, wallet connection, or API key required.

```sh
python -m http.server 8080 --directory web --bind 127.0.0.1
# Open http://127.0.0.1:8080
python kit.py eth examples/eth-snapshot.synthetic.json case.json
python kit.py eth examples/eth-snapshot.synthetic.json case.gs --gs
python kit.py sol examples/launch-map.synthetic.json solana-case.json
python kit.py rpc examples/eth-receipt.mainnet.json receipt-case.json
python assemble.py combined-case.json examples/eth-receipt.mainnet.json examples/eth-receipt-second.mainnet.json
python -m unittest discover -s tests -v
# Optional developer check, using Node 22+ (no npm install):
node --test tests/case.test.mjs
```

Output paths must be new. Keep private investigations in an untracked `private-cases/` folder. Use **Open local case** to inspect a CLI-produced case JSON. Files are validated and opened in browser memory; they are not uploaded, persisted, or sent to an RPC endpoint. Closing/reloading clears imported state. The static viewer makes no RPC calls and stores no credentials. Its bundled examples are fetched from its own site.

## Capture a real Ethereum receipt

Set `ETH_RPC_URL` in your shell to your HTTPS Ethereum mainnet endpoint, then run:

```sh
python collect.py 0x20f83f863231a8e1c97f14d1b2e9379d389c57d3bb82d265cd6e5d806378ba9b my-receipt-bundle.json
python kit.py rpc my-receipt-bundle.json my-case.json
```

Only four read methods are allowed: chain ID, transaction by hash, receipt, and block by hash. No signing, wallet connection, or transaction-submission methods exist. RPC redirects are rejected; timeouts and response sizes are bounded. Endpoint URLs and raw provider error messages are not saved or printed. Use an environment variable rather than putting a secret URL in command arguments. Contract-creation transactions, pending/unavailable receipts, other chains, and inconsistent bundles are rejected.

The adapter cross-checks hash, addresses, block height/hash, transaction index, and block membership. It uses the receipt's status and exact integer fee fields. A failed call has zero transferred value while retaining its requested value and fee. Zero-value successful calls remain calls. This is **provider-reported evidence**, not independently authenticated chain data or a finality check. No internal calls or token logs are decoded.

See [the reproducible case study](docs/REAL-CASE.md) and [Ethereum's RPC specification](https://ethereum.org/developers/docs/apis/json-rpc/).

## Assemble an investigation

`assemble.py OUTPUT INPUT...` accepts 1 to 50 Ethereum receipt-bundle files, each up to 2 MB. It validates every receipt, deduplicates matching transactions, rejects conflicts in projected transaction/receipt fields, and preserves canonical input-bundle checksums. Different capture timestamps can produce separate source checksums for the same consistent transaction. Source checksums are content references, not source authentication; retain the original bundles alongside the case for audit.

Input order does not affect the output checksum. Synthetic and nonsynthetic bundles cannot be mixed. The browser displays each transaction's own receipt, total fees across unique supplied transactions, and source references. This is a bounded selection of evidence, not automatic address crawling or a complete wallet history. Two transactions sharing a case or block do not establish a connection or common owner.

## What works

- Ethereum native account-transfer snapshot adapter using GraphSense's transaction response fields. Exact integer wei amounts remain strings.
- Solana `positano.launch-evidence.v1` adapter: positive fee-payer deltas remain **observations**, not asserted purchases, transfers, or bundles.
- Portable JSON with source links, explicit coverage, and a deterministic SHA-256 digest. A digest detects content changes; it does not prove blockchain truth.
- Native GraphSense `.gs` layout export through its pinned, attributed MIT codec. This format stores references/layout, not the underlying transaction database; opening it usefully requires a matching GraphSense backend.
- Browser graph, selectable evidence, local case import, checksum verification, address/transaction search, relationship and UTC date filters, chronological timeline, and full-case text reports.
- One real mainnet RPC capture with a reproducible fee calculation. No new third-party dependencies.

## Reuse and boundaries

GraphSense codec source is vendored unchanged under `vendor/graphsense_gs`, pinned in `vendor/PROVENANCE.json`, with its MIT license. We build an interoperability layer on that work, not a renamed GraphSense product.

The original GraphSense dashboard/backend has **not** been run here: its database stack is absent and Docker's engine is unavailable. Codec roundtrips and the portable viewer are tested separately. Solana is our portable evidence adapter, not claimed native GraphSense backend support. Cross-chain ownership, funding links, live monitoring, cryptographic execution verification, sanctions labels, and automatic risk scores are not implemented. The new receipt adapter checks consistency of supplied RPC fields; it does not independently verify Ethereum consensus.

The example GitHub Actions configuration in `docs/github-actions.example.yml` is not enabled: the current GitHub connection lacks workflow permission. Local Python and Node test commands above require no package installation.

## Roadmap

1. Current: reproducible offline cases, multi-transaction receipt assembly, local imports, mainnet receipt capture, evidence viewer, native ETH value-transfer export.
2. Read-only GraphSense API adapter, validated against a configured instance; explicit pagination and coverage.
3. Solana decoded transfers and creation allocations with transaction-level provenance and labeled inference.
4. Plugin contract for additional chains, case comparison, evidence export, and upstream contributions.

Contributions should include a small public or synthetic fixture, its source/coverage, and tests. Never commit keys, seed phrases, provider URLs containing credentials, or private case data. No repository should require a wallet seed to analyze public transactions.

MIT for original code; third-party notices retained. Created by [Positano777](https://github.com/Positano777).
