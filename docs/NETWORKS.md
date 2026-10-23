# Network coverage: bounded adapters, not universal tracing

v0.9 extends the common receipt/log/trace adapter to **11 EVM mainnets**. Bitcoin and Solana remain separate, bounded adapters, giving 13 named networks with implemented functionality. This is not support for every blockchain, full history on every network, or automatic tracing between them.

## EVM registry and provider setup

The single shared registry is `web/networks.json`, read by Python and browser/Node code. Network IDs and currency labels were checked against these primary sources. No RPC endpoints or credentials are embedded in the registry.

| Network | Chain ID | Native label | Server environment | Configuration source |
| --- | --- | --- | --- | --- |
| Ethereum | 1 | ETH | ETH_RPC_URL | [Ethereum EIP](https://eips.ethereum.org/EIPS/eip-2228) |
| OP Mainnet | 10 | ETH | OP_RPC_URL | [Optimism registry](https://github.com/ethereum-optimism/superchain-registry/blob/main/superchain/configs/mainnet/op.toml) |
| Base | 8453 | ETH | BASE_RPC_URL | [Base](https://docs.base.org/get-started/connect-to-base) |
| Arbitrum One | 42161 | ETH | ARB_RPC_URL | [Arbitrum](https://docs.arbitrum.io/chain-info) |
| Polygon PoS | 137 | POL | POLYGON_RPC_URL | [Polygon](https://support.polygon.technology/support/solutions/articles/82000889434-how-to-add-polygon-mainnet-on-metamask-) |
| BNB Smart Chain | 56 | BNB | BSC_RPC_URL | [BNB Chain](https://docs.bnbchain.org/bnb-smart-chain/developers/wallet-configuration/) |
| Avalanche C-Chain | 43114 | AVAX | AVAX_RPC_URL | [Avalanche](https://build.avax.network/docs/primary-network) |
| Gnosis | 100 | xDAI | GNOSIS_RPC_URL | [Gnosis](https://docs.gnosischain.com/about/networks/mainnet/) |
| Celo | 42220 | CELO | CELO_RPC_URL | [Celo](https://docs.celo.org/learn/network/overview) |
| Linea | 59144 | ETH | LINEA_RPC_URL | [Linea](https://docs.linea.build/get-started/build/network-info/) |
| Scroll | 534352 | ETH | SCROLL_RPC_URL | [Scroll](https://docs.scroll.io/en/developers) |

Set the selected provider variable to your HTTPS endpoint before running `python serve.py`. Open **EVM transaction capture**, select a network, paste a transaction hash, then capture and open the saved case. The selector shows configured/not-configured status without exposing endpoint URLs. EVM providers have no default endpoint in the application; endpoints are server-environment only. Public providers used for release validation were not added as runtime defaults.

**EVM mainnet example** loads a saved public case without provider access. Demo anchors include `#evm-base`, `#evm-bsc`, `#evm-polygon`, `#evm-avalanche`, and the other registry keys. Static hosting supports examples/import/graphs/reports/cards; capture, expansion, and persistence require the local service.

CLI:

```sh
python capture_assets.py transaction 56 TRANSACTION_HASH private-cases/bsc-evidence.json
node assets.mjs private-cases/bsc-evidence.json private-cases/bsc-case.json
python capture_assets.py hop 56 ADDRESS FIRST_BLOCK LAST_BLOCK private-cases/bsc-hop.json
node assets.mjs private-cases/bsc-hop.json private-cases/bsc-hop-case.json
```

Use `--trace` only when your provider supports the existing bounded built-in callTracer. Missing/rejected traces remain gaps. No signing or submission methods exist.

## Validation and provenance

Each registered network has a real projected transaction/receipt/block fixture in `examples/evm-KEY.mainnet.json` and a reconstructible case in `web/evm-KEY-case.json`. `web/network-validation.json` records the check time, fixture, and case digest. All 11 cases pass the shared offline reconstruction/checksum validation. A mainnet sample proves the sampled supported data shape worked; it does not certify every transaction type, provider, historical era, or tracer on that network.

The OP and Celo saved samples contain no decoded value/token movements. They still preserve a real zero-value call/receipt and fee fields. The interface explains that an empty movement graph does not establish no activity. Other examples include supported native movements or Transfer-shaped logs. No positive call-trace availability claim was established for the newly added networks.

Network checks compare the selected chain ID to `eth_chainId` before transaction collection. Addresses use `eip155:CHAIN:ADDRESS` node IDs, so matching address bytes on two networks do not collapse into one node. Cases and reports retain network context; record IDs must not be treated as globally unique without that context. Shared addresses, similar amounts, or timing do not establish a bridge transfer or common owner.

## Amounts, fees, and unsupported transactions

Native amounts remain exact base-unit strings and display using the selected network's 18-decimal native label. BNB, POL, AVAX, xDAI, and CELO are not displayed as ETH. Token amounts stay raw units; no decimals or balances are guessed.

The legacy `analysis.executionFeesWei` field is the exact receipt product `gasUsed * effectiveGasPrice`. It is **partial fee accounting**, not a universal complete transaction cost or a guaranteed isolated execution component. Blob, data, operator, or other chain-specific fees are excluded or not separately resolved. The UI/report explains this. Transactions exposing a non-null `feeCurrency` are rejected to avoid treating an alternate fee asset as native; provider omissions are not independently authenticated.

Bounds remain 1–20 explicit blocks, at most ten matching direct from/to transactions, 1,000 logs per receipt, projected traces bounded to 1,000 frames/depth 32, 2 MB artifacts/responses, and provider timeouts. Contract creation, unavailable/pending or structurally unsupported receipts, missing standard fields, and inconsistent inclusion data are rejected. Transfer-shaped events remain emitted claims, not verified token-standard compliance. Failed calls/reverted traces do not become successful value movement.

No complete history, token-only/internal-only address discovery, signature/consensus proof, finality verification, ownership attribution, or general cross-network fund matching is provided. The existing Ethereum-to-OP Portal connector is still restricted to its previously supported route/version. Supporting Base receipt inspection does not add Base bridging.

## Remaining networks

| Family / examples | Current status | Required release gate |
| --- | --- | --- |
| Bitcoin | Implemented, bounded | Existing outpoint capture and reported-spend checks; no full indexer |
| Solana | Implemented, bounded | Existing transaction parsing and five-signature account pages; no complete program decoding |
| Other EVM chains / L2s | Not in the reviewed registry | Official network metadata, chain-specific compatibility/fee review, saved real fixture, negative tests, browser checks |
| TRON | Not implemented | Dedicated reviewed collector/decoder and real fixtures |
| XRP Ledger | Not implemented | Dedicated reviewed collector/decoder and real fixtures |
| TON | Not implemented | Dedicated reviewed collector/decoder and real fixtures |
| Cosmos-family networks | Not implemented | Per-network identification, collector/decoder and real fixtures |
| Sui / Aptos | Not implemented | Separate chain-specific adapters and real fixtures |
| Cardano / NEAR / Polkadot-family networks | Not implemented | Separate chain-specific adapters and real fixtures |
| Litecoin / Dogecoin / other UTXO networks | Not implemented | Network-specific capture/identifier/spend semantics and fixtures; Bitcoin support is not automatically inherited |

This list is a planning boundary, not an exhaustive list of all networks. Adding a dropdown label is not adapter support. Each new adapter must pass the [connector contract](CONNECTOR-CONTRACT.md), preserve its source/coverage, and show unsupported activity clearly. No plugin package or executable was installed to add this release's network coverage.
