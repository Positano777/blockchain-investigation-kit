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
  $("run-local-hop").addEventListener("click", async () => {
    if (jobId) {
      status("An expansion is already being followed.");
      return;
    }
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
          "Open a bridge case or an asset case containing a transaction first.",
        );
      if (first + 4n > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error("Block number outside UI bounds");
      const job = await api("/api/expand", {
        chainId,
        address,
        fromBlock: Number(first),
        toBlock: Number(first + 4n),
        trace: false,
      });
      jobId = job.id;
      $("run-local-hop").disabled = true;
      status(
        "Expansion running locally: five blocks, at most ten direct-address transactions. The current view stays open.",
      );
      for (let i = 0; i < 600; i++) {
        const result = await api("/api/jobs/" + jobId);
        if (result.status === "succeeded") {
          jobId = null;
          $("run-local-hop").disabled = false;
          await refresh();
          $("saved-cases").value = result.caseId;
          status(
            "Expansion saved locally. Choose Open saved case to inspect it; zero records do not establish no activity.",
          );
          return;
        }
        if (result.status === "failed") throw new Error(result.message);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      throw new Error(
        "Stopped polling after 20 minutes. The server job may still be running; refresh saved cases later.",
      );
    } catch (error) {
      jobId = null;
      $("run-local-hop").disabled = false;
      status(error.message);
    }
  });
  api("/api/status")
    .then(async (data) => {
      token = data.token;
      $("local-controls").hidden = false;
      status(
        `Local service connected. Ethereum RPC: ${data.rpcConfigured["1"] ? "configured" : "not configured"}; Optimism RPC: ${data.rpcConfigured["10"] ? "configured" : "not configured"}. Provider URLs stay on the server.`,
      );
      await refresh();
    })
    .catch((error) => status(error.message));
}
