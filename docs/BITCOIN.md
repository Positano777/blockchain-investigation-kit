# Bitcoin UTXO connector preview

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

The new evidence and investigation schemas are **CLI-only**. The current browser/shared validator/local SQLite service do not yet import Bitcoin cases. Keep original evidence for offline reconstruction; the investigation SHA-256 checksum detects content changes, not truth. Browser persistence and interactive Bitcoin expansion are the next integration step.
