# Bitcoin UTXO investigations

This command-line connector captures one Bitcoin-mainnet transaction and the reported spending transaction for each spent output. It follows explicit outpoints, not address ownership. It reuses the public [Esplora API contract](https://github.com/Blockstream/esplora/blob/master/API.md); no Esplora source or new package is installed.

```sh
python bitcoin.py capture TRANSACTION_ID private-cases/btc-evidence.json
python bitcoin.py build private-cases/btc-evidence.json private-cases/btc-investigation.json
python bitcoin.py report private-cases/btc-evidence.json private-cases/btc-report.md
```

Create the output folder first. Existing output files are never overwritten. Python 3.11+ and standard library only. Capture defaults to `https://blockstream.info/api`; optionally set `BTC_ESPLORA_URL` to an HTTPS Bitcoin-mainnet Esplora base URL without query, fragment, or userinfo. Provider paths can contain credentials: endpoints and raw errors are excluded from evidence and diagnostics. The provider learns which transaction IDs you query.

Offline reproduction:

```sh
python bitcoin.py build examples/bitcoin-utxo.mainnet.json private-cases/reproduced-btc.json
python bitcoin.py report examples/bitcoin-utxo.mainnet.json private-cases/reproduced-btc.md
```

See [the saved mainnet report](BITCOIN-EXAMPLE.md). Its one input is 5,000,000,000 satoshis; outputs total the same amount, yielding a zero fee. Both reported spends are checked against the spending transactions' actual input references and previous-output fields. This checks consistency of provider responses, not raw serialized transaction hashes or consensus.

Bounds: at most 20 inputs and 20 outputs per transaction, at most 20 distinct spending transactions, at most 23 read requests, 20-second timeout and 2 MB per response. Final artifacts are capped at 2 MB. Oversized transactions, coinbase roots/spenders, duplicate inputs, wrong transaction IDs, inconsistent amounts/fees, mismatched spends/statuses, and redirects are rejected. The genesis checkpoint rejects an accidentally selected testnet/Liquid provider but does not authenticate an untrusted provider.

The capture is sequential, not an atomic chain snapshot. Unspent means *reported unspent at capture time*; mempool state and chain inclusion can change. Root parent values/scripts are supplied `prevout` fields, not separately captured parent transactions. No script execution, witness validation, transaction hash recomputation, proof-of-work/inclusion proof, finality, ancestry crawl, full wallet history, address clustering, change detection, ownership attribution, or input-to-output fund allocation is claimed. Fees remain exact integer satoshis.

Bitcoin investigation cases now work in the browser and local SQLite service. Use **Bitcoin outpoint trail** for the bundled mainnet example, or import the CLI-built investigation JSON (not the raw capture bundle). The shared JavaScript decoder reconstructs the case from its evidence and verifies the checksum before display/persistence.

With `python serve.py`, enter a transaction ID and choose **Capture selected Bitcoin transaction locally**. A bounded job captures one transaction and its reported spends and saves a new case. Select **Open saved case** to inspect it. In a spend record, **Select this transaction for next capture** fills its transaction ID; capture again to continue manually. The service uses server-configured `BTC_ESPLORA_URL` or the public default. No endpoint is accepted from the browser. All jobs share a single concurrency limit.

**What changed? Compare Bitcoin snapshots** accepts two valid cases for the same root transaction. It reports changed output-spend observations and confirmation statuses, flags conflicting transaction data, retains both digests/capture times, and never merges evidence. Current/comparison labels do not imply chronological order. This comparison has offline constructed test cases; no live mempool/reorganization event was observed.

**Download evidence card** renders a 1200 × 630 PNG locally with a checksum, reference, and coverage label. Analyst notes are excluded. The card summarizes evidence; send the full JSON and report alongside it. The static preview supports import, graph, comparison, reports, and cards, but cannot capture live data or save cases to SQLite.
