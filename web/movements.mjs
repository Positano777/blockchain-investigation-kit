import { evmNetwork } from "./networks.mjs";
import { bytes, hex, hash, quantity } from "./bridge.mjs";
const check = (ok, message = "Invalid asset evidence") => {
  if (!ok) throw new Error(message);
};
const keys = (o, required, optional = []) => {
  check(o && typeof o === "object" && !Array.isArray(o));
  check(
    required.every((k) => Object.hasOwn(o, k)) &&
      Object.keys(o).every((k) => [...required, ...optional].includes(k)),
  );
};
const norm = (v, n) => hex(bytes(v, n));
const integer = (v) => BigInt(v === "0x" ? "0x0" : v);
const wordAddress = (v) => {
  const b = bytes(v, 32);
  check(b.slice(0, 12).every((x) => x === 0));
  return hex(b.slice(12));
};
export const TRANSFER_TOPIC = hash(
  new TextEncoder().encode("Transfer(address,address,uint256)"),
);
const zero = "0x" + "0".repeat(40);
export function buildAssetCase(bundle) {
  keys(bundle, ["schema", "chainId", "synthetic", "records", "discovery"]);
  check(
    bundle.schema === "positano.asset-evidence.v1" &&
      typeof bundle.synthetic === "boolean",
  );
  const chain = quantity(bundle.chainId).toString();
  const profile = evmNetwork(chain),
    network = profile.key,
    explorer = profile.explorerTx;
  check(Array.isArray(bundle.records) && bundle.records.length <= 10);
  const discovery = bundle.discovery;
  keys(discovery, [
    "mode",
    "address",
    "fromBlock",
    "toBlock",
    "scannedBlocks",
    "limitReached",
  ]);
  check(
    ["supplied", "direct_address_blocks"].includes(discovery.mode) &&
      typeof discovery.limitReached === "boolean" &&
      Array.isArray(discovery.scannedBlocks),
  );
  const blockMap = new Map();
  if (discovery.mode === "supplied")
    check(
      discovery.address === null &&
        discovery.fromBlock === null &&
        discovery.toBlock === null &&
        discovery.scannedBlocks.length === 0 &&
        !discovery.limitReached,
    );
  else {
    norm(discovery.address, 20);
    check(
      typeof discovery.fromBlock === "string" &&
        typeof discovery.toBlock === "string" &&
        /^(0|[1-9][0-9]{0,19})$/.test(discovery.fromBlock) &&
        /^(0|[1-9][0-9]{0,19})$/.test(discovery.toBlock),
    );
    const first = BigInt(discovery.fromBlock),
      last = BigInt(discovery.toBlock);
    check(
      last >= first &&
        last - first < 20n &&
        discovery.scannedBlocks.length >= 1 &&
        discovery.scannedBlocks.length <= 20,
    );
    check(!discovery.limitReached || bundle.records.length === 10);
    for (const [i, b] of discovery.scannedBlocks.entries()) {
      keys(b, ["number", "hash"]);
      check(
        b.number === (first + BigInt(i)).toString() && BigInt(b.number) <= last,
      );
      blockMap.set(b.number, norm(b.hash, 32));
    }
    check(
      discovery.limitReached ||
        BigInt(discovery.scannedBlocks.length) === last - first + 1n,
    );
  }
  const nodes = new Map(),
    edges = [],
    seen = new Set();
  const stats = {
    transactions: bundle.records.length,
    traceAvailable: 0,
    traceMissing: 0,
    unrecognizedLogs: 0,
    unsupportedTransferLogs: 0,
    executionFeesWei: "0",
  };
  const node = (address) => {
    address = norm(address, 20);
    const id = `eip155:${chain}:${address}`;
    nodes.set(id, { id, network, kind: "address" });
    return id;
  };
  if (discovery.address) node(discovery.address);
  for (const record of bundle.records) {
    keys(record, ["transaction", "receipt", "block", "trace"]);
    const t = record.transaction,
      r = record.receipt,
      b = record.block;
    keys(t, [
      "hash",
      "from",
      "to",
      "value",
      "blockHash",
      "blockNumber",
      "transactionIndex",
    ]);
    keys(r, [
      "transactionHash",
      "from",
      "to",
      "status",
      "blockHash",
      "blockNumber",
      "transactionIndex",
      "gasUsed",
      "effectiveGasPrice",
      "logs",
    ]);
    keys(b, ["hash", "number", "timestamp", "transactions"]);
    const tx = norm(t.hash, 32),
      blockHash = norm(b.hash, 32),
      index = quantity(t.transactionIndex),
      value = quantity(t.value);
    check(!seen.has(tx));
    seen.add(tx);
    check(
      norm(r.transactionHash, 32) === tx &&
        norm(t.blockHash, 32) === blockHash &&
        norm(r.blockHash, 32) === blockHash,
    );
    check(
      quantity(t.blockNumber) === quantity(b.number) &&
        quantity(r.blockNumber) === quantity(b.number) &&
        quantity(r.transactionIndex) === index,
    );
    check(
      Array.isArray(b.transactions) &&
        b.transactions.length <= 10000 &&
        index < BigInt(b.transactions.length),
    );
    b.transactions.forEach((h) => norm(h, 32));
    check(norm(b.transactions[Number(index)], 32) === tx);
    const from = norm(t.from, 20),
      to = norm(t.to, 20);
    check(norm(r.from, 20) === from && norm(r.to, 20) === to);
    if (discovery.mode !== "supplied")
      check(
        blockMap.get(quantity(b.number).toString()) === blockHash &&
          (from === norm(discovery.address, 20) ||
            to === norm(discovery.address, 20)),
      );
    const timestamp = quantity(b.timestamp);
    check(timestamp <= 253402300799n);
    const status = quantity(r.status);
    check(status === 0n || status === 1n);
    stats.executionFeesWei = (
      BigInt(stats.executionFeesWei) +
      quantity(r.gasUsed) * quantity(r.effectiveGasPrice)
    ).toString();
    const add = (kind, a, z, amount, unit, ref, extra = {}) =>
      edges.push({
        id: tx + ":" + ref.kind + ":" + ref.index,
        from: node(a),
        to: node(z),
        kind,
        amount: amount.toString(),
        unit,
        timestamp: Number(timestamp),
        source: explorer + tx,
        transaction: tx,
        evidenceRef: ref,
        ...extra,
      });
    node(from);
    node(to);
    if (value > 0n)
      add(
        status ? "native_value" : "attempted_native_value",
        from,
        to,
        value,
        "wei",
        { kind: "transaction_value", index: "root" },
        { outcome: status ? "reported_success" : "reverted" },
      );
    check(Array.isArray(r.logs) && r.logs.length <= 1000);
    check(
      status === 1n || r.logs.length === 0,
      "Failed receipts must not retain emitted logs",
    );
    const logIndices = new Set();
    for (const log of r.logs) {
      keys(log, [
        "address",
        "topics",
        "data",
        "blockNumber",
        "transactionHash",
        "transactionIndex",
        "blockHash",
        "logIndex",
        "removed",
      ]);
      const emitter = norm(log.address, 20),
        li = quantity(log.logIndex).toString();
      check(!logIndices.has(li));
      logIndices.add(li);
      check(
        log.removed === false &&
          norm(log.transactionHash, 32) === tx &&
          norm(log.blockHash, 32) === blockHash &&
          quantity(log.blockNumber) === quantity(b.number) &&
          quantity(log.transactionIndex) === index,
      );
      check(Array.isArray(log.topics) && log.topics.length <= 4);
      log.topics.forEach((topic) => norm(topic, 32));
      bytes(log.data);
      if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) {
        stats.unrecognizedLogs++;
        continue;
      }
      if (
        !(
          (log.topics.length === 3 && bytes(log.data).length === 32) ||
          (log.topics.length === 4 && bytes(log.data).length === 0)
        )
      ) {
        stats.unsupportedTransferLogs++;
        continue;
      }
      const a = wordAddress(log.topics[1]),
        z = wordAddress(log.topics[2]);
      const nft = log.topics.length === 4;
      add(
        nft
          ? "nft_transfer_event"
          : a === zero
            ? "token_mint_event"
            : z === zero
              ? "token_burn_event"
              : "token_transfer_event",
        a,
        z,
        nft ? 1n : integer(log.data),
        nft ? "NFT event count" : "raw token units",
        { kind: "receipt_log", index: li },
        {
          outcome: "emitted_event",
          assetContract: emitter,
          ...(nft ? { tokenId: integer(log.topics[3]).toString() } : {}),
        },
      );
    }
    keys(record.trace, ["status", "root"]);
    check(
      ["available", "unavailable", "not_requested"].includes(
        record.trace.status,
      ),
    );
    if (record.trace.status !== "available") {
      check(record.trace.root === null);
      stats.traceMissing++;
      continue;
    }
    stats.traceAvailable++;
    const root = record.trace.root;
    check(
      root &&
        root.type === "CALL" &&
        norm(root.from, 20) === from &&
        norm(root.to, 20) === to &&
        quantity(root.value) === value,
    );
    check(
      !root.failed || status === 0n,
      "Trace root contradicts successful receipt",
    );
    let frames = 0;
    const walk = (frame, path, parentFailed, depth) => {
      keys(frame, ["type", "from", "to", "value", "failed", "calls"]);
      check(
        ++frames <= 1000 &&
          depth <= 32 &&
          Array.isArray(frame.calls) &&
          frame.calls.length <= 1000 &&
          typeof frame.failed === "boolean",
      );
      check(
        [
          "CALL",
          "STATICCALL",
          "DELEGATECALL",
          "CALLCODE",
          "CREATE",
          "CREATE2",
          "SELFDESTRUCT",
        ].includes(frame.type),
      );
      const a = norm(frame.from, 20),
        z = norm(frame.to, 20),
        amount = quantity(frame.value),
        failed = parentFailed || frame.failed;
      if (
        path !== "root" &&
        amount > 0n &&
        ["CALL", "CREATE", "CREATE2", "SELFDESTRUCT"].includes(frame.type)
      )
        add(
          failed ? "attempted_internal_value" : "internal_native_value",
          a,
          z,
          amount,
          "wei",
          { kind: "call_trace", index: path },
          { outcome: failed ? "reverted" : "reported_success" },
        );
      frame.calls.forEach((child, i) =>
        walk(child, path + "." + i, failed, depth + 1),
      );
    };
    walk(root, "root", status === 0n, 0);
  }
  check(
    edges.length <= 500 && nodes.size >= 1,
    "Case requires supplied records or a discovery address, and at most 500 movements",
  );
  return {
    schema: "positano.asset-case.v1",
    network,
    synthetic: bundle.synthetic,
    coverage:
      "Supplied RPC receipts and optional provider callTracer only. Transfer-shaped logs are emitted claims, not verified token balances or standard compliance. Reverted traces/attempts are not successful transfers; DELEGATECALL/CALLCODE values are excluded. Execution fees exclude blob, L1 data and operator fees. Discovery, when used, scans only direct from/to transactions in the recorded block range; token-only and internal-only address activity is not discovered. No complete history, net balances, exact fund attribution, ownership inference, or chain/finality proof.",
    nodes: [...nodes.values()],
    edges,
    analysis: stats,
    assetEvidence: bundle,
  };
}
