import { EVM_NETWORKS } from "./networks.mjs";
import { solanaId } from "./solana.mjs";
// Local service UI. The hosted static preview never probes localhost or receives RPC secrets.
export function initLocalService({ getCase, openCase }) {
  const $ = (id) => document.getElementById(id);
  if (
    !document.querySelector(
      'meta[name="investigation-service"][content="local"]',
    )
  )
    return;
  let token,
    activeId = null,
    jobId = null,
    revision = 0;
  let historyAddress = null,
    historyCursor = null;
  function busy(value) {
    for (const id of [
      "capture-evm",
      "run-local-hop",
      "capture-bitcoin",
      "capture-solana",
      "solana-history-start",
    ])
      $(id).disabled = value;
    $("solana-history-next").disabled = value || !historyCursor;
  }
  const status = (text) => {
    $("local-status").textContent = text;
  };
  async function api(path, data, method = "POST") {
    const response = await fetch(
      path,
      data === undefined
        ? {}
        : {
            method,
            headers: {
              "Content-Type": "application/json",
              "X-Investigation-Token": token,
            },
            body: JSON.stringify(data),
          },
    );
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Local service operation failed");
    return result;
  }
  async function refresh() {
    const result = await api("/api/cases");
    $("saved-cases").replaceChildren(
      new Option("Select a saved case", ""),
      ...result.cases.map(
        (c) => new Option(c.title + " / " + c.id.slice(0, 8), c.id),
      ),
    );
    if (activeId) $("saved-cases").value = activeId;
  }
  async function load(id) {
    const before = revision;
    const saved = await api("/api/cases/" + id);
    if (before !== revision) {
      status("View changed while loading. Select the saved case again.");
      return;
    }
    await openCase(saved.case);
    if (getCase()?.digest !== saved.case.digest) return;
    activeId = id;
    $("case-title").value = saved.title;
    $("case-note").value = saved.note;
    $("saved-cases").value = id;
    status(
      "Saved evidence opened. Notes are analyst annotations, separate from the evidence checksum.",
    );
  }
  document.addEventListener("investigation-case-changed", () => {
    revision++;
    historyAddress = null;
    historyCursor = null;
    $("solana-history-results").replaceChildren();
    $("solana-history-next").disabled = true;
    $("solana-history-status").textContent =
      "Select an account and request a bounded provider page.";
    activeId = null;
    $("case-title").value = "";
    $("case-note").value = "";
    $("saved-cases").value = "";
  });
  $("save-local").addEventListener("click", async () => {
    try {
      const before = revision;
      const title = $("case-title").value,
        note = $("case-note").value;
      if (activeId)
        await api("/api/cases/" + activeId, { title, note }, "PATCH");
      else {
        const evidence = getCase();
        if (!evidence) throw new Error("Open a case first");
        const savedId = (
          await api("/api/cases", { case: evidence, title, note })
        ).id;
        if (before === revision) activeId = savedId;
      }
      await refresh();
      status(
        "Saved on this computer. Evidence content is unchanged; notes remain separate.",
      );
    } catch (error) {
      status(error.message);
    }
  });
  $("refresh-local").addEventListener("click", () =>
    refresh().catch((e) => status(e.message)),
  );
  $("open-local").addEventListener("click", () => {
    const id = $("saved-cases").value;
    if (id) load(id).catch((e) => status(e.message));
  });
  async function run(path, data, message) {
    if (jobId) {
      status("A capture is already being followed.");
      return;
    }
    // Mark busy before awaiting the POST so double clicks cannot enqueue two jobs.
    jobId = "pending";
    busy(true);
    try {
      const job = await api(path, data);
      jobId = job.id;
      status(message);
      for (let i = 0; i < 600; i++) {
        const result = await api("/api/jobs/" + jobId);
        if (result.status === "succeeded") {
          await refresh();
          $("saved-cases").value = result.caseId;
          status(
            "Capture saved locally. Choose Open saved case to inspect it. The current view stays open.",
          );
          return;
        }
        if (result.status === "failed") throw new Error(result.message);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      throw new Error(
        "Stopped polling after 20 minutes. The server job may still run; refresh saved cases later.",
      );
    } catch (error) {
      status(error.message);
    } finally {
      jobId = null;
      busy(false);
    }
  }
  $("capture-evm").addEventListener("click", () => {
    const chainId = Number($("evm-chain").value),
      transaction = $("evm-transaction").value.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(transaction)) {
      status("Enter a 0x-prefixed EVM transaction hash.");
      return;
    }
    run(
      "/api/evm",
      { chainId, transaction, trace: false },
      "EVM capture running locally. The provider chain ID must match the selected network. Receipt/log evidence will be saved as a new case.",
    );
  });
  $("capture-solana").addEventListener("click", () => {
    try {
      const signature = solanaId($("solana-signature").value.trim(), 64);
      run(
        "/api/solana",
        { signature },
        "Solana capture running locally: mainnet checkpoint and one finalized-request transaction. Parsed evidence will be saved as a new case.",
      );
    } catch {
      status("Enter a valid base58 Solana transaction signature.");
    }
  });
  async function accountPage(next) {
    if (jobId) {
      status("A provider operation is already running.");
      return;
    }
    let address;
    try {
      address = solanaId($("solana-address").value.trim());
    } catch {
      status("Enter a valid Solana account address.");
      return;
    }
    if (next && address !== historyAddress) {
      status("Account changed. Start a new five-signature lookup.");
      return;
    }
    const before = next ? historyCursor : null,
      version = revision;
    jobId = "history";
    busy(true);
    $("solana-history-status").textContent =
      "Requesting at most five account references from the provider...";
    try {
      const result = await api("/api/solana/history", { address, before });
      if (version !== revision || address !== $("solana-address").value.trim())
        throw new Error("Case or account changed; request the page again.");
      historyAddress = address;
      historyCursor = result.nextBefore;
      $("solana-history-results").replaceChildren();
      for (const item of result.transactions) {
        const button = document.createElement("button");
        button.textContent = `Select signature ${item.signature} / slot ${item.slot} / transaction ${item.success ? "succeeded" : "failed"}`;
        button.addEventListener("click", () => {
          $("solana-signature").value = item.signature;
          status(
            "Signature selected. Capture it locally to inspect the transaction; account reference alone does not establish a payment.",
          );
        });
        $("solana-history-results").append(button);
      }
      $("solana-history-status").textContent =
        `${result.transactions.length} signatures returned; five-result cap reached: ${result.pageCapReached ? "yes" : "no"}. ${result.coverage}`;
    } catch (error) {
      $("solana-history-status").textContent = error.message;
    } finally {
      jobId = null;
      busy(false);
    }
  }
  $("solana-history-start").addEventListener("click", () => accountPage(false));
  $("solana-history-next").addEventListener("click", () => accountPage(true));
  $("capture-bitcoin").addEventListener("click", () => {
    const id = $("bitcoin-txid").value.trim();
    if (!/^[0-9a-f]{64}$/.test(id)) {
      status("Enter a lowercase 64-character Bitcoin transaction ID.");
      return;
    }
    run(
      "/api/bitcoin",
      { txid: id },
      "Bitcoin capture running locally: one transaction and its reported output spends, at most 23 requests. Evidence is saved as a new case.",
    );
  });
  $("run-local-hop").addEventListener("click", () => {
    try {
      const d = getCase();
      let chainId, address, first;
      if (d?.bridge) {
        chainId = 10;
        address = d.bridge.to;
        first = BigInt(d.evidence.destination.block.number) + 1n;
      } else if (d?.assetEvidence?.records.length) {
        chainId = Number(BigInt(d.assetEvidence.chainId));
        address = d.assetEvidence.records[0].transaction.to;
        first = BigInt(d.assetEvidence.records[0].block.number) + 1n;
      } else
        throw new Error(
          "Open a bridge or asset case for five-block expansion. For Bitcoin use the transaction capture button.",
        );
      if (first + 4n > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error("Block number outside UI bounds");
      run(
        "/api/expand",
        {
          chainId,
          address,
          fromBlock: Number(first),
          toBlock: Number(first + 4n),
          trace: false,
        },
        "Expansion running locally: five blocks, at most ten direct-address transactions. The current view stays open.",
      );
    } catch (error) {
      status(error.message);
    }
  });
  api("/api/status")
    .then(async (data) => {
      token = data.token;
      const selected = getCase()?.assetEvidence
        ? String(BigInt(getCase().assetEvidence.chainId))
        : "1";
      $("evm-chain").replaceChildren(
        ...EVM_NETWORKS.map(
          (row) =>
            new Option(
              `${row.name} (${row.symbol}) / ${data.rpcConfigured[String(row.chainId)] ? "configured" : "set " + row.rpcEnv}`,
              String(row.chainId),
            ),
        ),
      );
      $("evm-chain").value = selected;
      $("local-controls").hidden = false;
      status(
        `Local service connected. ${EVM_NETWORKS.filter((row) => data.rpcConfigured[String(row.chainId)]).length} of ${EVM_NETWORKS.length} EVM provider variables configured. Bitcoin and Solana capture: available using public defaults or configured server endpoints. Provider URLs stay on the server.`,
      );
      await refresh();
    })
    .catch((error) => status(error.message));
}
