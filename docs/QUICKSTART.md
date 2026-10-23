# Three-minute investigation walkthrough

1. Run `python serve.py` with Python 3.11+ and Node 22+. No package installation or wallet connection. Open the printed local URL.
2. Open **Bitcoin outpoint trail**. Inspect the 5,000,000,000 satoshi input, two outputs, and zero fee. Select a source record to see the outpoint and its explorer reference. Large graph circles are transactions; small ones are outputs.
3. Enter a case title and optional private note. **Save case / notes locally**, switch examples, then choose the saved case and **Open saved case**. Evidence and annotations stay separate.
4. In a spend record, select the transaction for next capture. **Capture selected Bitcoin transaction locally** collects one transaction and reported output spends, then saves a new case. Open the saved result. This is manual bounded exploration, not a recursive wallet crawler.
5. Export **Download case JSON**, **Export full report**, and **Download evidence card**. The PNG includes the digest/reference; share the JSON/report alongside it. Never post private evidence or notes by accident.
6. To compare two captures of the same Bitcoin transaction, open one and use **What changed?** to load the other. Review conflicting provider data before making a claim.

For offline-only viewing, serve `web/` as static files. Import, graph, filters, comparison, and exports work; server persistence/capture do not. Demo anchors include `#bitcoin`, `#bridge`, and `#assets`. For Solana, open **Solana transaction** or **Solana inner token evidence**, then use the local capture/account panel to inspect a signature or a five-result account page. Separate Solana transfer/failure labs remain explicitly synthetic. Read [Solana coverage](SOLANA.md).

Read [Bitcoin limits](BITCOIN.md) and [local storage details](LOCAL-SERVICE.md). An observed link is not an ownership assertion; a checksum is not chain authentication.
