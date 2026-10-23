import {
  EVM_NETWORKS,
  EVM_VALIDATION,
  evmNetwork,
  formatNative,
} from "./networks.mjs";
import { compareBitcoinCases } from "./compare.mjs";
import { verifyCase, filterEdges, formatEth, caseEdges } from "./case.mjs";
import { evidenceCardPng } from "./share.mjs";
import { initLocalService } from "./service.mjs";
import { openView } from "./workspace.mjs";
const $ = (id) => document.getElementById(id),
  ns = "http://www.w3.org/2000/svg";
let current,
  generation = 0,
  downloadUrl,
  selectedRecord;
function element(tag, attrs, text) {
  const n = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text) n.textContent = text;
  return n;
}
function paragraph(parent, label, value) {
  const p = document.createElement("p"),
    s = document.createElement("strong"),
    c = document.createElement("code");
  s.textContent = label + ": ";
  c.textContent = value;
  p.append(s, c);
  parent.append(p);
}
function nativeAmount(amount) {
  return current?.assetEvidence
    ? formatNative(amount, current.assetEvidence.chainId)
    : formatEth(amount);
}
function inspect(e) {
  selectedRecord = e.id + ":" + e.to;
  for (const row of $("records").querySelectorAll("button"))
    row.setAttribute(
      "aria-pressed",
      String(row.dataset.key === selectedRecord),
    );
  for (const line of $("graph").querySelectorAll(".edge"))
    line.classList.toggle("active", line.dataset.key === selectedRecord);
  $("details").replaceChildren();
  for (const [label, value] of [
    ["Record", e.id],
    ["Relationship", e.kind.replaceAll("_", " ")],
    [
      current.solanaAnalysis ? "Instruction amount" : "Amount",
      e.unit === "wei"
        ? nativeAmount(e.amount) + ` (${e.amount} atomic units)`
        : `${e.amount} ${e.unit}`,
    ],
    [
      current.bridge
        ? "Ethereum transaction ID"
        : current.network === "sol"
          ? "Mint observation anchor"
          : current.network === "bitcoin-mainnet"
            ? "From outpoint / transaction"
            : "From address",
      e.from,
    ],
    [
      current.bridge
        ? "Optimism transaction ID"
        : current.network === "sol"
          ? "Observed fee payer"
          : current.network === "bitcoin-mainnet"
            ? "To outpoint / transaction"
            : "To address",
      e.to,
    ],
    [
      "Time (UTC)",
      e.timestamp === null
        ? "Not supplied"
        : new Date(e.timestamp * 1000).toISOString(),
    ],
  ])
    if (!current.bridge) paragraph($("details"), label, value);
  if (current.network === "bitcoin-mainnet") {
    paragraph(
      $("details"),
      "Root transaction fee",
      current.feeSatoshis + " satoshis",
    );
    paragraph($("details"), "Captured at", current.evidence.capturedAt);
    if (e.inputIndex !== undefined)
      paragraph($("details"), "Spending input index", e.inputIndex);
    paragraph(
      $("details"),
      "Evidence basis",
      "Outpoint references and amounts checked against supplied provider data. No input-to-output allocation or ownership inference.",
    );
    if (e.to.startsWith("btc:tx:")) {
      const button = document.createElement("button");
      button.textContent = "Select this transaction for next capture";
      button.addEventListener("click", () => {
        $("bitcoin-txid").value = e.to.slice(7);
        openView("capture");
        $("message").textContent =
          "Transaction selected. Run locally to capture its outputs and reported spends.";
      });
      $("details").append(button);
    }
  }
  if (current.solanaAnalysis) {
    const a = current.solanaAnalysis;
    paragraph($("details"), "Transaction outcome", a.status);
    paragraph(
      $("details"),
      "Instruction outcome",
      e.outcome.replaceAll("_", " "),
    );
    paragraph(
      $("details"),
      "Source instruction",
      JSON.stringify(e.evidenceRef),
    );
    if (e.unit === "raw_token_units")
      paragraph(
        $("details"),
        "Token mint",
        e.assetMint ?? "Not supplied; do not aggregate with other tokens",
      );
    paragraph(
      $("details"),
      "Meaning",
      e.outcome === "committed"
        ? "Supported top-level transfer in a provider-reported successful transaction."
        : e.outcome === "not_committed"
          ? "Transaction failed. This instruction amount is not a committed transfer; some instructions may not have executed."
          : "Inner instruction listed by the provider. Local CPI success is not verified, even when the enclosing transaction succeeds.",
    );
    const button = document.createElement("button");
    button.textContent = "Select recipient for Solana account lookup";
    button.addEventListener("click", () => {
      $("solana-address").value = e.to.split(":").at(-1);
      $("message").textContent =
        "Recipient account selected. Use the local account lookup to request at most five signatures; no ownership or payment relation is inferred.";
    });
    $("details").append(button);
  }
  if (current.assetEvidence)
    paragraph(
      $("details"),
      "Network",
      `${evmNetwork(current.assetEvidence.chainId).name} / chain ID ${BigInt(current.assetEvidence.chainId)}`,
    );
  if (current.analysis) {
    paragraph(
      $("details"),
      "Evidence reference",
      JSON.stringify(e.evidenceRef),
    );
    paragraph($("details"), "Outcome", e.outcome);
    if (e.assetContract)
      paragraph(
        $("details"),
        "Emitting token contract (not independently verified)",
        e.assetContract,
      );
    if (e.tokenId) paragraph($("details"), "Token ID", e.tokenId);
    paragraph(
      $("details"),
      "How this connection was obtained",
      e.evidenceRef.kind === "receipt_log"
        ? "Decoded from a supplied, successful receipt log. Events can be emitted by nonstandard or malicious contracts."
        : e.evidenceRef.kind === "call_trace"
          ? "Reported by provider callTracer. Reverted ancestors propagate failure; inherited DELEGATECALL/CALLCODE values are not counted."
          : "Top-level value from the supplied transaction, paired with receipt status.",
    );
  }
  if (current.bridge) {
    const b = current.bridge;
    for (const [label, value] of [
      ["Protocol", "Ethereum → OP Mainnet Portal v0"],
      ["ETH minted by deposit", formatEth(b.mintWei)],
      ["Requested L2 call value", formatEth(b.valueWei)],
      ["RPC L2 execution status", b.destinationStatus],
      ["L2 call value after status", formatEth(b.transferredTopLevelWei)],
      [
        "Destination time (UTC)",
        new Date(b.destinationTimestamp * 1000).toISOString(),
      ],
    ])
      paragraph($("details"), label, value);
    const advanced = document.createElement("details"),
      title = document.createElement("summary");
    title.textContent = "Derivation and transaction identifiers";
    advanced.append(title);
    for (const [label, value] of [
      ["Source hash", b.sourceHash],
      ["Ethereum transaction", b.sourceTransaction],
      ["Optimism transaction", b.destinationTransaction],
      ["Global L1 log index", b.logIndex],
      ["L1 block hash", b.sourceBlock],
      ["L2 block hash", b.destinationBlock],
      ["L2 sender (may be an L1 alias)", b.from],
      ["L2 target", b.to],
      ["Gas limit", b.gasLimit],
    ])
      paragraph(advanced, label, value);
    $("details").append(advanced);
    const destination = document.createElement("a");
    destination.textContent = "Open Optimism transaction";
    destination.href =
      "https://optimistic.etherscan.io/tx/" + b.destinationTransaction;
    destination.target = "_blank";
    destination.rel = "noopener noreferrer";
    $("details").append(destination);
  }
  if (current.receipt || current.receipts?.[e.id]) {
    const r = current.receipt || current.receipts[e.id];
    for (const [label, value] of [
      ["RPC receipt status", r.status],
      ["Execution fee", formatEth(r.executionFeeWei)],
      ["Blob fee", formatEth(r.blobFeeWei)],
      ["Total fee", formatEth(r.totalFeeWei)],
      ["Requested top-level value", formatEth(r.requestedValueWei)],
      ["Block", r.blockNumber],
    ])
      paragraph($("details"), label, value);
  }
  for (const source of current.sources?.filter(
    (source) => source.transaction === e.id,
  ) || [])
    paragraph($("details"), "Source bundle checksum", source.bundleDigest);
  const warning = document.createElement("p");
  warning.textContent = current.synthetic
    ? "Synthetic identifier: explorer links are format examples, not evidence of existing transactions."
    : "Imported/provider-reported evidence. A matching checksum does not authenticate its source or establish finality.";
  const link = document.createElement("a");
  link.textContent = "Explorer reference";
  link.href = e.source;
  link.rel = "noopener noreferrer";
  link.target = "_blank";
  $("details").append(warning, link);
  document
    .querySelectorAll(".edge")
    .forEach((line) =>
      line.classList.toggle("active", line.dataset.key === e.id + ":" + e.to),
    );
}
function render() {
  if (!current) return;
  const edges = filterEdges(current, {
    query: $("search").value,
    kind: $("kind").value,
    from: $("from").value,
    until: $("until").value,
  });
  const invalidDates =
    $("from").value && $("until").value && $("from").value > $("until").value;
  $("filter-feedback").textContent = invalidDates
    ? "The start date is after the end date. Adjust the dates or clear filters."
    : `${edges.length} of ${current.edges.length} records match. Select a connection or record to inspect its evidence.`;
  $("graph").replaceChildren();
  $("records").replaceChildren();
  const shown = [],
    ids = new Set();
  for (const e of edges) {
    const expanded = new Set([...ids, e.from, e.to]);
    if (expanded.size <= 24 && shown.length < 40) {
      shown.push(e);
      expanded.forEach((id) => ids.add(id));
    }
  }
  const nodes = current.nodes.filter((n) => ids.has(n.id));
  const positions = new Map(
    nodes.map((n, i) => [
      n.id,
      current.bridge
        ? [120 + i * 460, 220]
        : [
            350 +
              (nodes.length === 1
                ? 0
                : 255 * Math.cos((i * Math.PI * 2) / nodes.length)),
            220 +
              (nodes.length === 1
                ? 0
                : 155 * Math.sin((i * Math.PI * 2) / nodes.length)),
          ],
    ]),
  );
  const defs = element("defs", {}),
    marker = element("marker", {
      id: "arrow",
      viewBox: "0 0 10 10",
      refX: 17,
      refY: 5,
      markerWidth: 5,
      markerHeight: 5,
      orient: "auto-start-reverse",
    });
  marker.append(
    element("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "#718e7e" }),
  );
  defs.append(marker);
  $("graph").append(defs);
  for (const e of shown) {
    const [x1, y1] = positions.get(e.from),
      [x2, y2] = positions.get(e.to);
    const d =
      e.from === e.to
        ? `M ${x1} ${y1} C ${x1 - 70} ${y1 - 85}, ${x1 + 70} ${y1 - 85}, ${x1} ${y1}`
        : `M ${x1} ${y1} L ${x2} ${y2}`;
    const line = element("path", {
      d,
      class: "edge" + (e.outcome ? " " + e.outcome : ""),
      fill: "none",
      ...(e.kind === "token_gain_observation"
        ? { "stroke-dasharray": "6 5" }
        : { "marker-end": "url(#arrow)" }),
    });
    line.dataset.key = e.id + ":" + e.to;
    line.setAttribute("tabindex", "0");
    line.setAttribute("role", "button");
    line.setAttribute(
      "aria-label",
      `Inspect ${e.kind.replaceAll("_", " ")}: ${e.amount} ${e.unit}`,
    );
    line.addEventListener("click", () => inspect(e));
    line.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        inspect(e);
      }
    });
    $("graph").append(line);
  }
  for (const n of nodes) {
    const [x, y] = positions.get(n.id),
      circle = element("circle", {
        cx: x,
        cy: y,
        r: n.kind === "transaction" ? 19 : 12,
        class: n.kind === "transaction" ? "transaction-node" : "",
        tabindex: 0,
        role: "button",
        "aria-label":
          (current.network === "bitcoin-mainnet"
            ? "Filter outpoint / transaction "
            : current.bridge
              ? "Filter transaction "
              : "Filter address ") + n.id,
      });
    const focus = () => {
      $("search").value = n.id;
      render();
    };
    circle.addEventListener("click", focus);
    circle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        focus();
      }
    });
    $("graph").append(
      circle,
      element(
        "text",
        { x, y: y + 32, "text-anchor": "middle" },
        (current.bridge || current.analysis
          ? n.network + " / " + n.id.split(":").at(-1).slice(0, 7)
          : n.id.slice(0, 7)) +
          "..." +
          n.id.slice(-4),
      ),
    );
  }
  $("graph-title").textContent =
    `${edges.length} of ${current.edges.length} records / ${nodes.length} shown nodes`;
  $("graph-note").textContent =
    `Graph shows ${shown.length} matching records (maximum 24 nodes / 40 connections). Select any record below. Dashed lines are observations; arrows show top-level call/value direction, not ownership.`;
  if (current.bridge)
    $("graph-note").textContent =
      "Ethereum deposit event → derived OP transaction hash → captured Optimism receipt. The link is computed from the protocol encoding, not guessed from timing or amount.";
  if (current.network === "bitcoin-mainnet")
    $("graph-note").textContent =
      `Graph shows ${shown.length} of ${current.edges.length} records, bounded to 24 nodes / 40 connections. Large circles are transactions; small circles are outpoints. Arrows show spends and creates, not ownership or allocation of particular input coins to outputs.`;
  if (current.solanaAnalysis)
    $("graph-note").textContent =
      `${shown.length} displayed instruction records (maximum 24 nodes / 40 connections). Solid supported top-level transfers are committed only on transaction success. Dashed amber lines have unverified inner outcomes; dashed red lines are not committed. Account deltas do not become transfer edges.`;
  if (current.analysis)
    $("graph-note").textContent =
      `Graph shows ${shown.length} supplied movements/attempts, bounded to 24 nodes and 40 connections. Select a record to explain its source. Reverted attempts are not successful transfers; token event amounts use raw units.`;
  for (const e of edges) {
    const row = document.createElement("button");
    row.className = "row";
    row.dataset.key = e.id + ":" + e.to;
    if (e.outcome) row.dataset.outcome = e.outcome;
    row.textContent =
      (current.solanaAnalysis ? e.outcome.replaceAll("_", " ") + " / " : "") +
      e.kind.replaceAll("_", " ") +
      " / " +
      (e.unit === "wei" ? nativeAmount(e.amount) : e.amount + " " + e.unit);
    const sub = document.createElement("span");
    sub.textContent =
      (e.timestamp === null
        ? "Time unavailable"
        : new Date(e.timestamp * 1000).toISOString()) +
      " / " +
      e.id;
    row.append(sub);
    row.addEventListener("click", () => inspect(e));
    $("records").append(row);
  }
  $("details").replaceChildren();
  if (edges.length)
    inspect(
      edges.find((e) => e.id + ":" + e.to === selectedRecord) || edges[0],
    );
  else {
    const emptySolana = current.solanaAnalysis && current.edges.length === 0;
    const emptyEvm = current.assetEvidence && current.edges.length === 0;
    $("details").textContent = emptySolana
      ? "No supported transfer instructions decoded. Execution and balance observations above remain available; this does not establish no activity."
      : emptyEvm
        ? "No supported value/token movements decoded. Zero-value calls and unsupported logs may still be present in the captured receipt. This does not establish no activity."
        : "No matching records. Clear the filters to see this case.";
    $("records").textContent = emptySolana
      ? "No supported transfer records. Review the unsupported-instruction count and coverage."
      : emptyEvm
        ? "No decoded movements. The transaction receipt remains in the full case JSON and fee summary."
        : "No records match these filters.";
    if (emptyEvm && current.assetEvidence.records.length) {
      const record = current.assetEvidence.records[0];
      paragraph($("details"), "Captured transaction", record.transaction.hash);
      paragraph(
        $("details"),
        "Receipt status",
        BigInt(record.receipt.status) === 1n ? "success" : "failed",
      );
      const link = document.createElement("a");
      link.textContent = "Open captured transaction";
      link.href =
        evmNetwork(current.assetEvidence.chainId).explorerTx +
        record.transaction.hash;
      link.rel = "noopener noreferrer";
      link.target = "_blank";
      $("details").append(link);
    }
  }
}
async function activate(d, token, example = "") {
  await verifyCase(d);
  if (token !== generation) return;
  current = d;
  selectedRecord = null;
  document.dispatchEvent(new Event("investigation-case-changed"));
  $("comparison-result").textContent = "";
  $("download-comparison").disabled = true;
  $("hop-command").textContent = "";
  $("hop-command").closest("details").open = false;
  for (const key of [
    "eth",
    "sol",
    "real",
    "multi",
    "bridge",
    "assets",
    "hop",
    "trace",
    "bitcoin",
    "solana",
    "solana-token",
    "solana-lab",
    "solana-failed",
  ])
    $(key).setAttribute("aria-pressed", String(key === example));
  $("case-status").textContent = d.synthetic
    ? "Synthetic example"
    : example
      ? "Saved mainnet example"
      : "Opened evidence";
  $("case-name").textContent = d.assetEvidence
    ? evmNetwork(d.assetEvidence.chainId).name + " transaction evidence"
    : d.network === "bitcoin-mainnet"
      ? "Bitcoin transaction trail"
      : d.solanaAnalysis
        ? "Solana transaction evidence"
        : d.bridge
          ? "Ethereum → Optimism deposit"
          : "Blockchain evidence case";
  $("case-count").textContent =
    `${d.nodes.length} nodes · ${d.edges.length} records`;
  const receipts = d.receipts
    ? Object.values(d.receipts)
    : d.receipt
      ? [d.receipt]
      : [];
  $("summary").textContent =
    `${d.nodes.length} addresses / ${d.edges.length} records / ${receipts.length} supplied receipts. ` +
    (receipts.length
      ? `Total fees across unique supplied transactions: ${formatEth(receipts.reduce((sum, r) => sum + BigInt(r.totalFeeWei), 0n).toString())}. This is not a wallet balance or complete spending history.`
      : "Coverage is limited to the supplied observations.");
  if (d.network === "bitcoin-mainnet") {
    const t = d.evidence.transaction;
    $("summary").textContent =
      `Bitcoin mainnet: ${t.vin.length} inputs / ${t.vout.length} outputs / ${d.evidence.outspends.filter((o) => o.spent).length} reported spent outputs. Root fee: ${d.feeSatoshis} satoshis. Spends were checked against supplied spending inputs; this does not identify owners or allocate input funds.`;
    $("bitcoin-txid").value = t.txid;
  }
  $("solana-overview").hidden = !d.solanaAnalysis;
  if (d.solanaAnalysis) {
    const a = d.solanaAnalysis;
    $("solana-signature").value = a.signature;
    $("solana-address").value = a.feePayer;
    $("summary").textContent =
      `Solana mainnet / transaction ${a.status} / fee ${a.feeLamports} lamports / ${d.edges.length} supported instruction records / ${a.unsupportedInstructions} instructions not decoded. Inner coverage: ${a.innerCoverage}. Inner outcomes are unverified; balance changes are observations.`;
    $("solana-execution").replaceChildren();
    $("solana-balances").replaceChildren();
    for (const [label, value] of [
      ["Signature", a.signature],
      ["Slot", a.slot],
      ["Fee payer", a.feePayer],
      ["Fee (charged even on failure)", a.feeLamports + " lamports"],
      [
        "RPC commitment requested",
        a.requestedCommitment + " (not independently authenticated)",
      ],
    ])
      paragraph($("solana-execution"), label, value);
    for (const account of a.balanceObservations)
      paragraph(
        $("solana-balances"),
        account.address,
        `${account.preLamports} -> ${account.postLamports} lamports; observed delta ${account.deltaLamports}`,
      );
  }
  if (d.bridge)
    $("summary").textContent =
      `Ethereum (1) → OP Mainnet (10). Exact destination transaction hash derived from the supplied Portal event. Deposit mint: ${formatEth(d.bridge.mintWei)}. Destination receipt: ${d.bridge.destinationStatus}. This is a protocol deposit link, not proof of common ownership or complete asset movement.`;
  if (d.analysis) {
    $("evm-chain").value = String(BigInt(d.assetEvidence.chainId));
    $("evm-demo").value = evmNetwork(d.assetEvidence.chainId).key;
    $("evm-transaction").value =
      d.assetEvidence.records[0]?.transaction.hash ?? "";
    $("summary").textContent =
      `${d.analysis.transactions} supplied transactions / ${d.edges.length} movements or attempts. Trace coverage: ${d.analysis.traceAvailable} available, ${d.analysis.traceMissing} missing/not requested. ${d.analysis.unrecognizedLogs} other logs and ${d.analysis.unsupportedTransferLogs} unsupported Transfer-shaped logs not decoded. ${evmNetwork(d.assetEvidence.chainId).name}: receipt gasUsed × effectiveGasPrice = ${formatNative(d.analysis.executionFeesWei, d.assetEvidence.chainId)}. Partial fee accounting; chain-specific extra fees are excluded or not separately resolved.`;
  }
  if (d.assetEvidence?.discovery.mode === "direct_address_blocks") {
    const s = d.assetEvidence.discovery;
    $("summary").textContent +=
      ` Direct-address scan: ${s.scannedBlocks.length} blocks inspected in requested range ${s.fromBlock}–${s.toBlock}. Transaction cap reached: ${s.limitReached ? "yes" : "no"}. Zero results means no captured direct from/to transactions in this range, not no activity.`;
  }
  $("coverage").textContent =
    `${d.synthetic ? "SYNTHETIC EXAMPLE. " : "PROVIDER / IMPORTED DATA. "}${d.coverage} Checksum matched (not source authentication): ${d.digest}`;
  for (const id of ["search", "from", "until"]) $(id).value = "";
  $("kind").replaceChildren(
    new Option("All relationships", ""),
    ...Array.from(new Set(d.edges.map((e) => e.kind))).map(
      (k) => new Option(k.replaceAll("_", " "), k),
    ),
  );
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = URL.createObjectURL(
    new Blob([JSON.stringify(d, null, 2) + "\n"], { type: "application/json" }),
  );
  $("download").href = downloadUrl;
  $("download").download = d.network + "-case.json";
  $("message").textContent = example
    ? "Bundled example loaded. Your local files stay in this browser."
    : "Local case opened in memory. Nothing uploaded or saved to a server.";
  $("message").dataset.state = "ready";
  render();
  document.dispatchEvent(new Event("investigation-case-ready"));
}
async function show(example) {
  const token = ++generation;
  $("message").dataset.state = "loading";
  $("message").textContent = "Opening and checking evidence…";
  try {
    const response = await fetch(example + "-case.json");
    if (!response.ok)
      throw new Error(
        "Example unavailable. Try another example or import a case.",
      );
    await activate(await response.json(), token, example);
    if (token === generation) history.replaceState(null, "", "#" + example);
  } catch (error) {
    if (token === generation) fail(error);
  }
}
function fail(error) {
  $("message").dataset.state = "error";
  $("message").textContent = error.message || "Unable to load case.";
}
for (const example of [
  "eth",
  "sol",
  "real",
  "multi",
  "bridge",
  "assets",
  "hop",
  "trace",
  "bitcoin",
  "solana",
  "solana-token",
  "solana-lab",
  "solana-failed",
])
  $(example).addEventListener("click", () => show(example).catch(fail));
$("import").addEventListener("change", async (event) => {
  const file = event.target.files[0],
    token = ++generation;
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error("Case exceeds 2 MB.");
    await activate(JSON.parse(await file.text()), token);
    if (token === generation)
      history.replaceState(null, "", location.pathname + location.search);
  } catch (error) {
    if (token === generation) fail(error);
  }
  event.target.value = "";
});
for (const id of ["search", "kind", "from", "until"])
  $(id).addEventListener("input", render);
$("reset").addEventListener("click", () => {
  for (const id of ["search", "kind", "from", "until"]) $(id).value = "";
  render();
});
$("report").addEventListener("click", () => {
  if (!current) return;
  const lines = [
    "Positano Investigations / case report",
    current.synthetic
      ? "SYNTHETIC EXAMPLE"
      : "IMPORTED / PROVIDER-REPORTED EVIDENCE",
    current.coverage,
    "Content checksum (not authenticity): " + current.digest,
    "",
    "Full case records (filters do not limit this report):",
  ];
  for (const e of caseEdges(current))
    lines.push(
      "",
      e.kind,
      e.from + " -> " + e.to,
      e.unit === "wei" && current.assetEvidence
        ? nativeAmount(e.amount) + " / " + e.amount + " atomic units"
        : e.amount + " " + e.unit,
      e.timestamp === null
        ? "Time not supplied"
        : new Date(e.timestamp * 1000).toISOString(),
      e.source,
    );
  if (current.network === "bitcoin-mainnet")
    lines.push(
      "",
      "Root fee (satoshis): " + current.feeSatoshis,
      "Capture time: " + current.evidence.capturedAt,
      "Full Bitcoin evidence:",
      JSON.stringify(current.evidence, null, 2),
    );
  if (current.solanaAnalysis)
    lines.push(
      "",
      "Solana instruction references and outcomes:",
      JSON.stringify(
        current.edges.map((e) => ({
          record: e.id,
          reference: e.evidenceRef,
          outcome: e.outcome,
          assetMint: e.assetMint ?? null,
        })),
        null,
        2,
      ),
      "Solana execution and balance observations:",
      JSON.stringify(current.solanaAnalysis, null, 2),
      "Full projected evidence:",
      JSON.stringify(current.solanaEvidence, null, 2),
    );
  if (current.receipt)
    lines.push(
      "",
      "Receipt summary:",
      JSON.stringify(current.receipt, null, 2),
    );
  if (current.analysis)
    lines.push(
      "",
      "Movement evidence references:",
      JSON.stringify(
        current.edges.map((e) => ({
          record: e.id,
          reference: e.evidenceRef,
          outcome: e.outcome,
          assetContract: e.assetContract ?? null,
          tokenId: e.tokenId ?? null,
        })),
        null,
        2,
      ),
    );
  if (current.bridge)
    lines.push(
      "",
      "Cross-network derivation:",
      JSON.stringify(current.bridge, null, 2),
      "Source: https://etherscan.io/tx/" + current.bridge.sourceTransaction,
      "Destination: https://optimistic.etherscan.io/tx/" +
        current.bridge.destinationTransaction,
      "Download the full JSON case to retain the supplied RPC evidence.",
    );
  if (current.assetEvidence)
    lines.push(
      "",
      "EVM network:",
      JSON.stringify(evmNetwork(current.assetEvidence.chainId), null, 2),
      "Receipt fee product is partial; it is not a complete cross-network transaction cost.",
    );
  if (current.analysis)
    lines.push(
      "",
      "Asset coverage:",
      JSON.stringify(current.analysis, null, 2),
      "Discovery scope:",
      JSON.stringify(current.assetEvidence.discovery, null, 2),
      "Download full JSON to retain receipts, projected traces, and movement evidence references.",
    );
  if (current.receipts)
    lines.push(
      "",
      "Receipts by transaction:",
      JSON.stringify(current.receipts, null, 2),
      "",
      "Source bundle checksums (not source authentication):",
      JSON.stringify(current.sources, null, 2),
    );
  const url = URL.createObjectURL(
      new Blob([lines.join("\n") + "\n"], { type: "text/plain" }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download = "investigation-report.txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("expand").addEventListener("click", () => {
  let chain, address, start;
  if (current?.solanaAnalysis) {
    const sig = current.solanaAnalysis.signature;
    $("hop-command").textContent =
      `Run locally:\npython solana.py capture ${sig} next-solana-evidence.json\npython solana.py build next-solana-evidence.json next-solana-case.json\nFor a bounded account page:\npython solana.py history ${current.solanaAnalysis.feePayer} account-page.json\nNo recursive history, trade classification, ownership, or pump.fun lifecycle decoding.`;
    return;
  }
  if (current?.network === "bitcoin-mainnet") {
    const id = $("bitcoin-txid").value.trim();
    $("hop-command").textContent = /^[0-9a-f]{64}$/.test(id)
      ? `Run locally:\npython bitcoin.py capture ${id} next-bitcoin-evidence.json\npython bitcoin.py build next-bitcoin-evidence.json next-bitcoin-case.json\nOpen next-bitcoin-case.json here. Bounded to one transaction and its reported output spends; no recursive wallet crawl.`
      : "Select or enter a Bitcoin transaction first.";
    return;
  }
  if (current?.bridge) {
    chain = 10;
    address = current.bridge.to;
    start = BigInt(current.evidence.destination.block.number) + 1n;
  } else if (current?.assetEvidence && current.assetEvidence.records.length) {
    chain = Number(BigInt(current.assetEvidence.chainId));
    address = current.assetEvidence.records[0].transaction.to;
    start = BigInt(current.assetEvidence.records[0].block.number) + 1n;
  } else {
    $("hop-command").textContent =
      "Open a bridge case or an asset case with a transaction first.";
    return;
  }
  $("hop-command").textContent =
    `Set ${evmNetwork(chain).rpcEnv} to your HTTPS provider in your shell, then run locally:\npython capture_assets.py hop ${chain} ${address} ${start} ${start + 4n} next-hop-evidence.json\nnode assets.mjs next-hop-evidence.json next-hop-case.json\nOpen next-hop-case.json here. Scans five explicit blocks, captures at most ten direct from/to transactions, and excludes token-only/internal-only discovery. This follows the selected call target, not an attributed owner or specific deposited coins.`;
});
$("compare-import").addEventListener("change", async (event) => {
  const file = event.target.files[0],
    base = current;
  event.target.value = "";
  if (!file || !base) return;
  $("download-comparison").disabled = true;
  try {
    if (file.size > 2000000) throw new Error("Comparison case exceeds 2 MB.");
    const result = await compareBitcoinCases(
      base,
      JSON.parse(await file.text()),
    );
    if (current !== base)
      throw new Error("Current case changed; compare again.");
    $("comparison-result").textContent = JSON.stringify(result, null, 2);
    $("download-comparison").disabled = false;
    $("message").dataset.state = "ready";
    $("message").textContent =
      `Compared two snapshots: ${result.changes.length} changed observations, ${result.conflicts.length} data conflicts. Original evidence is unchanged.`;
  } catch (error) {
    $("comparison-result").textContent = "";
    fail(error);
  }
});
$("download-comparison").addEventListener("click", () => {
  const text = $("comparison-result").textContent;
  if (!text) {
    $("message").textContent = "Compare two Bitcoin snapshots first.";
    return;
  }
  const url = URL.createObjectURL(
    new Blob([text + "\n"], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "bitcoin-snapshot-comparison.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("share-card").addEventListener("click", async () => {
  if (!current) return;
  const base = current;
  $("share-card").disabled = true;
  try {
    const blob = await evidenceCardPng(base),
      url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "positano-evidence-card.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("message").textContent =
      "PNG evidence card downloaded. Share it with the full case JSON and report so others can reproduce the finding. Analyst notes are excluded.";
  } catch (error) {
    fail(error);
  } finally {
    $("share-card").disabled = false;
  }
});
$("evm-demo").replaceChildren(
  ...EVM_NETWORKS.map(
    (profile) =>
      new Option(
        `${profile.name} / chain ${profile.chainId} / ${profile.symbol}`,
        profile.key,
      ),
  ),
);
$("open-evm-demo").addEventListener("click", () =>
  show("evm-" + $("evm-demo").value).catch(fail),
);
for (const profile of EVM_NETWORKS) {
  const row = document.createElement("p");
  row.textContent = `${profile.name} / chain ${profile.chainId} / native ${profile.symbol}. Saved mainnet sample: ${EVM_VALIDATION.find((v) => v.chainId === profile.chainId)?.status === "mainnet_fixture" ? "captured and checked" : "not verified"}. Bounded receipt/log/trace evidence only.`;
  $("network-coverage").append(row);
}
initLocalService({
  getCase: () => current,
  openCase: async (data) => {
    const token = ++generation;
    await activate(data, token);
    if (token === generation)
      history.replaceState(null, "", location.pathname + location.search);
  },
});
const examples = [
  ...EVM_NETWORKS.map((profile) => "evm-" + profile.key),
  "solana",
  "solana-token",
  "solana-lab",
  "solana-failed",
  "bitcoin",
  "bridge",
  "assets",
  "trace",
  "hop",
  "multi",
  "real",
  "eth",
  "sol",
];
window.addEventListener("hashchange", () => {
  const key = location.hash.slice(1);
  if (examples.includes(key)) show(key).catch(fail);
});
show(
  examples.includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "bitcoin",
).catch(fail);
