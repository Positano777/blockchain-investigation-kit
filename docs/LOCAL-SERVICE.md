# Local investigation workspace

Run from the repository with Python 3.11+ and Node 22+; no package installation:

```sh
python serve.py
```

Open the printed `http://127.0.0.1:8080` URL. Keep the process running. Static hosting and `python -m http.server` still support offline viewing, but do not provide local service features. The hosted preview never probes your localhost or receives provider credentials.

## Save, annotate, reopen

Open any supported case, enter a title and analyst note, and choose **Save case / notes locally**. Saved cases appear in the selector; choose **Open saved case** to restore evidence and annotations. Notes/title are editable separately. The stored evidence and its checksum remain immutable; importing or switching cases clears the active saved-case association.

SQLite data lives under the git-ignored `private-cases/investigations.sqlite3` directory by default. Use `--data-dir PATH` for another local location and `--port PORT` for another loopback port. Evidence persists across server restarts. The list shows the 100 most recently updated cases. Back up the database as private investigation data. Notes currently live in this database and are not included in the viewer's evidence-only JSON/report exports. No cloud synchronization, multi-user sharing, deletion UI, encryption at rest, or case-merging claim is made.

## Collect from the interface

Set ETH_RPC_URL and/or OP_RPC_URL in the server's shell before starting. The status panel exposes only configured/not-configured flags. Open a bridge or asset case and choose **Run five-block expansion locally**. The server selects the existing supported address/range workflow, runs a bounded job, validates the returned case, and saves it. The current view stays open; select the saved result to inspect it.

The UI uses the selected call target and five following blocks. API bounds remain 1–20 explicit blocks and at most ten direct-address transactions. Token-only/internal-only address activity is not discovered. The UI does not request tracing by default; API tracing retains existing availability limits. No provider endpoint can be supplied through the HTTP request. A zero-result saved case remains a bounded observation, not evidence of no activity or proof of where deposited coins went.

Bitcoin capture uses the public Esplora default unless `BTC_ESPLORA_URL` is set in the server environment. Enter a transaction ID, capture it, then open the saved result. Bitcoin cases preserve outpoint relationships and can be annotated like other cases.

Only one expansion/capture runs at a time across all chains. Job status is kept in memory (latest 20 jobs), while successful cases are persistent. The UI polls for up to 20 minutes; a failed/disconnected browser does not cancel a running job. There is no durable job queue or cancellation feature yet. Provider reads retain existing request timeouts and response caps. Errors hide raw provider details.

## Local access boundary

The CLI binds only to 127.0.0.1. Requests require an expected localhost Host header; writes additionally require the same Origin and a random, per-process session token held in browser memory. No cross-origin API permission is granted. Responses disable caching, directory listings are disabled, and the static directory excludes the case database. These are local-browser protections, not a multi-user authentication system. Do not reverse-proxy or expose this service publicly.

Case validation runs the existing Node decoders through bounded stdin/stdout without a shell. Credentials remain environment-only. The service does not sign transactions, execute arbitrary tracer code, accept shell commands, install software, or upload saved cases to Sites/GitHub.

See [the connector contract](CONNECTOR-CONTRACT.md) for implemented versus planned chain support. Bitcoin transaction capture/persistence is integrated; see [Bitcoin workflow and bounds](BITCOIN.md). Full Solana history and pump.fun lifecycle adapters remain planned.
