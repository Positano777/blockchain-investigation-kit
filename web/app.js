import { verifyCase, filterEdges, formatEth } from "./case.mjs";
const $ = (id) => document.getElementById(id),
  ns = "http://www.w3.org/2000/svg";
let current,
  generation = 0,
  downloadUrl;
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
function inspect(e) {
  $("details").replaceChildren();
  for (const [label, value] of [
    ["Record", e.id],
    ["Relationship", e.kind.replaceAll("_", " ")],
    [
      "Amount",
      e.unit === "wei"
        ? formatEth(e.amount) + ` (${e.amount} wei)`
        : `${e.amount} ${e.unit}`,
    ],
    [
      current.bridge
        ? "Ethereum transaction ID"
        : current.network === "sol"
          ? "Mint observation anchor"
          : "From address",
      e.from,
    ],
    [
      current.bridge
        ? "Optimism transaction ID"
        : current.network === "sol"
          ? "Observed fee payer"
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
      class: "edge",
      fill: "none",
      ...(e.kind === "token_gain_observation"
        ? { "stroke-dasharray": "6 5" }
        : { "marker-end": "url(#arrow)" }),
    });
    line.dataset.key = e.id + ":" + e.to;
    line.addEventListener("click", () => inspect(e));
    $("graph").append(line);
  }
  for (const n of nodes) {
    const [x, y] = positions.get(n.id),
      circle = element("circle", {
        cx: x,
        cy: y,
        r: 16,
        tabindex: 0,
        role: "button",
        "aria-label":
          (current.bridge ? "Filter transaction " : "Filter address ") + n.id,
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
        (current.bridge
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
  for (const e of edges) {
    const row = document.createElement("button");
    row.className = "row";
    row.textContent =
      e.kind.replaceAll("_", " ") +
      " / " +
      (e.unit === "wei" ? formatEth(e.amount) : e.amount + " " + e.unit);
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
  if (edges.length) inspect(edges[0]);
  else {
    $("details").textContent =
      "No matching records. Clear the filters to see this case.";
    $("records").textContent = "No records match these filters.";
  }
}
async function activate(d, token, example = "") {
  await verifyCase(d);
  if (token !== generation) return;
  current = d;
  for (const key of ["eth", "sol", "real", "multi", "bridge"])
    $(key).setAttribute("aria-pressed", String(key === example));
  $("case-status").textContent = d.synthetic
    ? "SYNTHETIC CASE / v0.4"
    : "IMPORTED EVIDENCE / v0.4";
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
  if (d.bridge)
    $("summary").textContent =
      `Ethereum (1) → OP Mainnet (10). Exact destination transaction hash derived from the supplied Portal event. Deposit mint: ${formatEth(d.bridge.mintWei)}. Destination receipt: ${d.bridge.destinationStatus}. This is a protocol deposit link, not proof of common ownership or complete asset movement.`;
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
  render();
}
async function show(example) {
  const token = ++generation,
    response = await fetch(example + "-case.json");
  if (!response.ok) throw new Error("Case unavailable");
  await activate(await response.json(), token, example);
}
function fail(error) {
  $("message").textContent = error.message || "Unable to load case.";
}
for (const example of ["eth", "sol", "real", "multi", "bridge"])
  $(example).addEventListener("click", () => show(example).catch(fail));
$("import").addEventListener("change", async (event) => {
  const file = event.target.files[0],
    token = ++generation;
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error("Case exceeds 2 MB.");
    await activate(JSON.parse(await file.text()), token);
  } catch (error) {
    fail(error);
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
  for (const e of current.edges)
    lines.push(
      "",
      e.kind,
      e.from + " -> " + e.to,
      e.amount + " " + e.unit,
      e.timestamp === null
        ? "Time not supplied"
        : new Date(e.timestamp * 1000).toISOString(),
      e.source,
    );
  if (current.receipt)
    lines.push(
      "",
      "Receipt summary:",
      JSON.stringify(current.receipt, null, 2),
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
show("bridge").catch(fail);
