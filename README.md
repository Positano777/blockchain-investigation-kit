# Positano Investigations

An open-source starting point for portable blockchain investigations: inspect a graph, follow its source transactions, and export evidence for other tools.

**v0.1 prototype. Examples are synthetic.** This is a small working foundation, not a full blockchain indexer or a production forensic platform.

## Run locally

Python 3.11+; no pip installs, wallet connection, or API key required.

```sh
python -m http.server 8080 --directory web --bind 127.0.0.1
# Open http://127.0.0.1:8080
python kit.py eth examples/eth-snapshot.synthetic.json case.json
python kit.py eth examples/eth-snapshot.synthetic.json case.gs --gs
python kit.py sol examples/launch-map.synthetic.json solana-case.json
python -m unittest discover -s tests -v
```

Output paths must be new. Keep real investigations in an untracked `private-cases/` folder. The static viewer loads only bundled examples; it makes no RPC calls and stores no credentials.

## What works

- Ethereum native account-transfer snapshot adapter using GraphSense's transaction response fields. Exact integer wei amounts remain strings.
- Solana `positano.launch-evidence.v1` adapter: positive fee-payer deltas remain **observations**, not asserted purchases, transfers, or bundles.
- Portable JSON with source links, explicit coverage, and a deterministic SHA-256 digest. A digest detects content changes; it does not prove blockchain truth.
- Native GraphSense `.gs` layout export through its pinned, attributed MIT codec. This format stores references/layout, not the underlying transaction database; opening it usefully requires a matching GraphSense backend.
- Browser graph, selectable evidence, timeline, downloadable example cases.

## Reuse and boundaries

GraphSense codec source is vendored unchanged under `vendor/graphsense_gs`, pinned in `vendor/PROVENANCE.json`, with its MIT license. We build an interoperability layer on that work, not a renamed GraphSense product.

The original GraphSense dashboard/backend has **not** been run here: its database stack is absent and Docker's engine is unavailable. Codec roundtrips and the portable viewer are tested separately. Solana is our portable evidence adapter, not claimed native GraphSense backend support. Cross-chain ownership, funding links, live monitoring, receipts/execution verification, sanctions labels, and automatic risk scores are not implemented.

## Roadmap

1. Current: reproducible offline cases, evidence viewer, native ETH export.
2. Read-only GraphSense API adapter, validated against a configured instance; explicit pagination and coverage.
3. Solana decoded transfers and creation allocations with transaction-level provenance and labeled inference.
4. Plugin contract for additional chains, case comparison, evidence export, and upstream contributions.

Contributions should include a small public or synthetic fixture, its source/coverage, and tests. Never commit keys, seed phrases, provider URLs containing credentials, or private case data. No repository should require a wallet seed to analyze public transactions.

MIT for original code; third-party notices retained. Created by [Positano777](https://github.com/Positano777).
