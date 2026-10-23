# Solana transaction investigations

The bounded Solana connector captures a transaction by signature, preserves exact lamport/token instruction amounts, and explains execution status and instruction provenance. It supports **System Program `transfer`** and **classic SPL Token `transfer` / `transferChecked`**. It does not decode swaps, Token-2022, account creation, staking, NFTs, pump.fun launch/curve/migration, or arbitrary program semantics. Unsupported instructions are counted and retain their program ID/location in the projected evidence, rather than being silently labeled trades.

## Run and follow a transaction

Run `python serve.py` (Python 3.11+ and Node 22+), then open **Solana transaction**. The bundled mainnet example reports a 1,170-lamport System transfer, 5,000-lamport transaction fee, and seven unsupported top-level instructions. Its signature is recorded in `examples/solana-transaction.mainnet.json`. **Solana inner token evidence** is a second real capture with one parsed classic token CPI instruction; its local outcome remains unverified.

In **Solana capture and account lookup**, paste a signature and choose **Capture Solana transaction locally**. The capture becomes a new saved case; open it to inspect the graph, fee payer, execution status, instruction references, and exact account balance observations. Notes remain separate from evidence. Provider URLs stay in server environment variables.

A transfer record can fill the recipient account for follow-up. **Find five account signatures** requests one bounded page; **Next older page** passes its `before` cursor. Select a returned signature, then explicitly capture it. Account references do not prove payments or common ownership. Pages are discovery observations, not persistent investigation cases or complete history; only selected transactions are captured/saved. No automatic history crawl or signature batching runs.

CLI equivalents:

```sh
python solana.py capture SIGNATURE private-cases/solana-evidence.json
python solana.py build private-cases/solana-evidence.json private-cases/solana-case.json
python solana.py history ACCOUNT private-cases/account-page.json
python solana.py history ACCOUNT private-cases/older-page.json --before SIGNATURE
```

Create the output directory first. Existing files are never overwritten. Capture/history require Python standard library only; build/shared validation requires Node 22+. Defaults use `https://api.mainnet-beta.solana.com`; set `SOL_RPC_URL` before starting the service to select your HTTPS provider. Public providers may rate-limit or lack older transactions. There are no signing/submission methods. The provider learns the signatures/accounts queried.

## Meaning of the evidence

- `committed`: a supported **top-level** transfer instruction in a provider-reported successful transaction. This trusts the provider's parsed instruction/status, rather than verifying serialized bytes or signatures.
- `not_committed`: the entire transaction failed. Instruction amounts are not committed transfers; the instruction list does not establish which later instructions executed. The reported fee remains visible.
- `inner_outcome_unverified`: the provider listed a CPI transfer instruction, but this decoder does not reconstruct its local success or caught failures. A successful outer transaction alone does not promote it into a confirmed payment.
- Lamport pre/post balances and their exact integer deltas remain **observations**, separate from transfer edges. Fees, rent, account creation/closure, and other program actions can affect balances; the decoder does not invent transfers from deltas.
- Token amounts stay raw integer strings. Checked transfers retain reported mint/decimals. Unchecked transfers use a mint only when supplied source/destination token-balance metadata is consistent; otherwise mint is unknown. Token accounts are not silently replaced by wallet owners. Different or unknown token assets are never aggregated.

The [Solana transaction documentation](https://solana.com/docs/core/transactions) describes transaction failure and atomic execution; [getTransaction](https://solana.com/docs/rpc/http/gettransaction), [JSON structures](https://solana.com/docs/rpc/json-structures), and [getSignaturesForAddress](https://solana.com/docs/rpc/http/getsignaturesforaddress) define the provider data used here. No third-party Solana SDK was installed or copied.

## Bounds and gaps

Transaction capture performs two RPC reads: mainnet genesis checkpoint, then `getTransaction` with `jsonParsed`, requested `finalized` commitment, and maximum supported version 0. Legacy and v0 only; later versions and missing transaction metadata are rejected. The genesis response and requested commitment are not independently authenticated chain/finality proofs.

Limits: 2 MB per RPC response and final artifact; 20-second timeout per read; 256 resolved accounts; 128 top-level instructions; 256 top-level plus inner instructions. All amount fields are projected to exact decimal u64 strings before JavaScript sees them. Block/slot/index fields use safe integers. Program IDs, source/destination account membership, fee payer flags, inner indices, and projected data shapes are checked. No raw memo, log messages, provider errors, or endpoint URLs enter exported evidence.

Account lookup performs two RPC reads with a fixed limit of five. Each page retains address, requested cursor, capture time, returned signatures/slots/status, cap indicator, next cursor, and coverage. A full page does not prove another page exists; an empty page does not establish no activity. History lookup and captures share the service's single provider-operation limit. Provider changes/reorganizations between separate requests are not independently resolved.

Supported program parsing is narrow. Inner instruction stack heights/log success, raw message signature verification, validator consensus, rent attribution, complete history, swap/trade classification, pump.fun lifecycle, and ownership heuristics remain out of scope. The projected evidence records unsupported programs and counts; it cannot reproduce arbitrary original instructions from raw bytes. The shared validator reconstructs the portable case and checks its content checksum, not blockchain truth.

## Reproduce and share

```sh
python solana.py build examples/solana-transaction.mainnet.json private-cases/reproduced-solana.json
python solana.py build examples/solana-token-inner.mainnet.json private-cases/reproduced-inner-token.json
```

Import the generated case, export its full report/JSON, and download a 1200 × 630 PNG evidence card. The card includes signature, fee, execution status, checksum, and an uncommitted-amount warning. Analyst notes are excluded. Send JSON/report with the card so readers can inspect coverage. Static hosting supports these offline features, but not live capture, account lookup, or SQLite persistence.

`solana-transfers.synthetic.json` and `solana-failed.synthetic.json` test exact u64 handling, successful top-level versus unverified inner outcomes, and failed-transaction semantics. They are explicitly synthetic and are not mainnet evidence. The two saved mainnet captures are live observations; no live failed transaction was used to demonstrate failure handling.
