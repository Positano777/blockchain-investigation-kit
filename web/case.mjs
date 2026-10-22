const hex = (v, n) =>
  typeof v === "string" && new RegExp(`^0x[0-9a-f]{${n}}$`).test(v);
function b58(v, size) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  if (typeof v !== "string" || !v.length || v.length > 90) return false;
  let n = 0n,
    bytes = 0;
  for (const c of v) {
    const d = alphabet.indexOf(c);
    if (d < 0) return false;
    n = n * 58n + BigInt(d);
  }
  while (n > 0n) {
    bytes++;
    n >>= 8n;
  }
  return bytes + v.length - v.replace(/^1+/, "").length === size;
}
function check(v) {
  if (!v) throw new Error("Invalid or unsupported case fields.");
}
function keys(v, required, optional = []) {
  check(v && typeof v === "object" && !Array.isArray(v));
  check(
    required.every((k) => Object.hasOwn(v, k)) &&
      Object.keys(v).every((k) => [...required, ...optional].includes(k)),
  );
}
export function validateCase(d) {
  keys(
    d,
    ["schema", "network", "synthetic", "coverage", "nodes", "edges", "digest"],
    ["receipt", "receipts", "sources"],
  );
  check(
    d.schema === "positano.investigation.v1" &&
      ["eth", "sol"].includes(d.network),
  );
  check(
    typeof d.synthetic === "boolean" &&
      typeof d.coverage === "string" &&
      d.coverage.length <= 2000 &&
      /^sha256:[0-9a-f]{64}$/.test(d.digest),
  );
  check(
    Array.isArray(d.nodes) &&
      d.nodes.length >= 1 &&
      d.nodes.length <= 1000 &&
      Array.isArray(d.edges) &&
      d.edges.length <= 500,
  );
  const ids = new Map(),
    seen = new Set();
  for (const n of d.nodes) {
    keys(n, ["id", "network", "kind"]);
    check(n.network === d.network && !ids.has(n.id));
    check(
      d.network === "eth"
        ? hex(n.id, 40) && n.kind === "address"
        : b58(n.id, 32) && ["mint", "fee_payer"].includes(n.kind),
    );
    ids.set(n.id, n.kind);
  }
  for (const e of d.edges) {
    keys(e, [
      "id",
      "from",
      "to",
      "kind",
      "amount",
      "unit",
      "timestamp",
      "source",
    ]);
    check(
      ids.has(e.from) &&
        ids.has(e.to) &&
        typeof e.amount === "string" &&
        e.amount.length <= 78,
    );
    check(
      e.timestamp === null ||
        (Number.isSafeInteger(e.timestamp) &&
          e.timestamp >= 0 &&
          e.timestamp <= 253402300799),
    );
    if (d.network === "eth") {
      check(
        hex(e.id, 64) &&
          [
            "reported_native_transfer",
            "rpc_value_transfer",
            "rpc_call",
            "rpc_failed_call",
          ].includes(e.kind),
      );
      check(
        /^(0|[1-9][0-9]*)$/.test(e.amount) &&
          e.unit === "wei" &&
          e.timestamp !== null,
      );
      check(e.source === "https://etherscan.io/tx/" + e.id);
      check(
        !["rpc_call", "rpc_failed_call"].includes(e.kind) || e.amount === "0",
      );
    } else {
      check(
        b58(e.id, 64) &&
          e.kind === "token_gain_observation" &&
          e.unit === "approximate % of supply",
      );
      check(
        /^[0-9]+(?:\.[0-9]+)?(?:e-[0-9]+)?$/.test(e.amount) &&
          Number(e.amount) > 0 &&
          Number(e.amount) <= 100,
      );
      check(
        e.source === "https://solscan.io/tx/" + e.id &&
          ids.get(e.from) === "mint" &&
          ids.get(e.to) === "fee_payer",
      );
    }
    const key = d.network === "eth" ? e.id : e.id + ":" + e.to;
    check(!seen.has(key));
    seen.add(key);
  }
  check(!(Object.hasOwn(d, "receipt") && Object.hasOwn(d, "receipts")));
  if (Object.hasOwn(d, "receipt")) {
    const r = d.receipt;
    keys(r, [
      "status",
      "requestedValueWei",
      "gasUsed",
      "effectiveGasPriceWei",
      "executionFeeWei",
      "blobFeeWei",
      "totalFeeWei",
      "blockNumber",
      "blockHash",
      "transactionIndex",
    ]);
    check(
      d.network === "eth" &&
        d.edges.length === 1 &&
        ["success", "failed"].includes(r.status),
    );
    for (const k of [
      "requestedValueWei",
      "gasUsed",
      "effectiveGasPriceWei",
      "executionFeeWei",
      "blobFeeWei",
      "totalFeeWei",
      "blockNumber",
    ])
      check(typeof r[k] === "string" && /^(0|[1-9][0-9]{0,155})$/.test(r[k]));
    check(
      hex(r.blockHash, 64) &&
        Number.isSafeInteger(r.transactionIndex) &&
        r.transactionIndex >= 0,
    );
    check(
      BigInt(r.gasUsed) * BigInt(r.effectiveGasPriceWei) ===
        BigInt(r.executionFeeWei),
    );
    check(
      BigInt(r.executionFeeWei) + BigInt(r.blobFeeWei) ===
        BigInt(r.totalFeeWei),
    );
    const e = d.edges[0];
    check(
      e.kind ===
        (r.status === "failed"
          ? "rpc_failed_call"
          : r.requestedValueWei === "0"
            ? "rpc_call"
            : "rpc_value_transfer"),
    );
    check(e.amount === (r.status === "failed" ? "0" : r.requestedValueWei));
  } else if (Object.hasOwn(d, "receipts")) {
    check(d.network === "eth" && d.edges.length >= 1 && d.edges.length <= 50);
    check(
      d.receipts &&
        typeof d.receipts === "object" &&
        !Array.isArray(d.receipts),
    );
    check(Object.keys(d.receipts).length === d.edges.length);
    for (const edge of d.edges) {
      check(Object.hasOwn(d.receipts, edge.id));
      validateCase({
        schema: d.schema,
        network: d.network,
        synthetic: d.synthetic,
        coverage: d.coverage,
        nodes: d.nodes,
        edges: [edge],
        digest: d.digest,
        receipt: d.receipts[edge.id],
      });
    }
    check(
      Array.isArray(d.sources) &&
        d.sources.length >= 1 &&
        d.sources.length <= 50,
    );
    const sources = new Set(),
      referenced = new Set();
    for (const source of d.sources) {
      keys(source, ["transaction", "bundleDigest"]);
      check(
        Object.hasOwn(d.receipts, source.transaction) &&
          /^sha256:[0-9a-f]{64}$/.test(source.bundleDigest),
      );
      const key = source.transaction + ":" + source.bundleDigest;
      check(!sources.has(key));
      sources.add(key);
      referenced.add(source.transaction);
    }
    check(referenced.size === d.edges.length);
  } else check(d.edges.every((e) => !e.kind.startsWith("rpc_")));
  check(!Object.hasOwn(d, "sources") || Object.hasOwn(d, "receipts"));
  return d;
}
export function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.keys(v)
        .sort()
        .map((k) => canonical(k) + ":" + canonical(v[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(v).replace(
    /[\u007f-\uffff]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}
export async function verifyCase(d, crypto = globalThis.crypto) {
  validateCase(d);
  const { digest, ...content } = d;
  const result = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(content)),
  );
  const actual =
    "sha256:" +
    Array.from(new Uint8Array(result), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  if (actual !== digest)
    throw new Error(
      "Case checksum mismatch. Content changed or export is incompatible.",
    );
  return d;
}
export function filterEdges(
  d,
  { query = "", kind = "", from = "", until = "" } = {},
) {
  const q = query.trim().toLowerCase();
  return d.edges
    .filter(
      (e) =>
        (!kind || e.kind === kind) &&
        (!q ||
          [e.id, e.from, e.to, e.kind].some((v) =>
            v.toLowerCase().includes(q),
          )) &&
        (!from ||
          (e.timestamp !== null &&
            e.timestamp >= Date.parse(from + "T00:00:00Z") / 1000)) &&
        (!until ||
          (e.timestamp !== null &&
            e.timestamp < Date.parse(until + "T00:00:00Z") / 1000 + 86400)),
    )
    .sort(
      (a, b) =>
        (a.timestamp ?? Infinity) - (b.timestamp ?? Infinity) ||
        (d.receipts?.[a.id]?.blockHash === d.receipts?.[b.id]?.blockHash
          ? (d.receipts?.[a.id]?.transactionIndex ?? 0) -
            (d.receipts?.[b.id]?.transactionIndex ?? 0)
          : 0) ||
        a.id.localeCompare(b.id),
    );
}
export function formatEth(wei) {
  const v = BigInt(wei),
    f = (v % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return v / 10n ** 18n + (f ? "." + f : "") + " ETH";
}
