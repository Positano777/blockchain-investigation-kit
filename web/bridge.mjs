// OP Mainnet version-0 Portal deposit derivation. See docs/OP-DEPOSIT.md.
import { keccak_256 } from "./vendor/noble-hashes/sha3.js";
export const PORTAL = "0xbeb5fc579115071764c7423a4f12edde41f106ed";
export const hex = (bytes) =>
  "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
export const hash = (bytes) => hex(keccak_256(bytes));
const check = (ok, message = "Invalid OP deposit evidence") => {
  if (!ok) throw new Error(message);
};
function keys(value, required, optional = []) {
  check(value && typeof value === "object" && !Array.isArray(value));
  check(
    required.every((key) => Object.hasOwn(value, key)) &&
      Object.keys(value).every((key) =>
        [...required, ...optional].includes(key),
      ),
    "Unexpected evidence fields",
  );
}
export function bytes(value, size) {
  check(
    typeof value === "string" &&
      /^0x(?:[0-9a-fA-F]{2})*$/.test(value) &&
      value.length <= 262146,
  );
  const out = Uint8Array.from(value.slice(2).match(/../g) || [], (s) =>
    parseInt(s, 16),
  );
  if (size !== undefined) check(out.length === size);
  return out;
}
const join = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
};
const integer = (b) => BigInt(hex(b) || "0x0");
export function quantity(v) {
  check(
    typeof v === "string" && /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]{0,63})$/.test(v),
  );
  return BigInt(v);
}
function uint(n) {
  check(typeof n === "bigint" && n >= 0n);
  let h = n.toString(16);
  if (n === 0n) return new Uint8Array();
  if (h.length % 2) h = "0" + h;
  return bytes("0x" + h);
}
const word = (n) => {
  const b = uint(n);
  check(b.length <= 32);
  const out = new Uint8Array(32);
  out.set(b, 32 - b.length);
  return out;
};
function prefix(n, offset) {
  return n < 56
    ? Uint8Array.of(offset + n)
    : join(
        Uint8Array.of(offset + 55 + uint(BigInt(n)).length),
        uint(BigInt(n)),
      );
}
export function rlp(value) {
  if (Array.isArray(value)) {
    const data = join(...value.map(rlp));
    return join(prefix(data.length, 0xc0), data);
  }
  check(value instanceof Uint8Array);
  return value.length === 1 && value[0] < 128
    ? value
    : join(prefix(value.length, 0x80), value);
}
export const DEPOSIT_TOPIC = hash(
  new TextEncoder().encode(
    "TransactionDeposited(address,address,uint256,bytes)",
  ),
);
function normalized(v, size) {
  return hex(bytes(v, size));
}
export function validateMined(bundle, chainId) {
  keys(bundle, ["chainId", "transaction", "receipt", "block"]);
  check(quantity(bundle.chainId) === BigInt(chainId), "Wrong chain ID");
  const t = bundle.transaction,
    r = bundle.receipt,
    b = bundle.block;
  check(t && r && b, "Mined transaction, receipt, and block required");
  const txFields = [
    "hash",
    "from",
    "to",
    "value",
    "blockHash",
    "blockNumber",
    "transactionIndex",
  ];
  keys(
    t,
    chainId === 10
      ? [...txFields, "type", "sourceHash", "gas", "input"]
      : txFields,
    chainId === 10 ? ["mint", "isSystemTx"] : [],
  );
  keys(r, [
    "transactionHash",
    "from",
    "to",
    "status",
    "blockHash",
    "blockNumber",
    "transactionIndex",
    ...(chainId === 1 ? ["logs"] : []),
  ]);
  keys(b, ["hash", "number", "timestamp", "transactions"]);
  quantity(t.value);
  const tx = normalized(t.hash, 32),
    blockHash = normalized(b.hash, 32);
  check(normalized(r.transactionHash, 32) === tx);
  check(
    normalized(t.blockHash, 32) === blockHash &&
      normalized(r.blockHash, 32) === blockHash,
  );
  check(
    quantity(t.blockNumber) === quantity(b.number) &&
      quantity(r.blockNumber) === quantity(b.number),
  );
  const index = quantity(t.transactionIndex);
  check(
    index < 10000n &&
      Array.isArray(b.transactions) &&
      b.transactions.length <= 10000,
  );
  b.transactions.forEach((tx) => normalized(tx, 32));
  check(
    index < BigInt(b.transactions.length) &&
      normalized(b.transactions[Number(index)], 32) === tx &&
      quantity(r.transactionIndex) === index,
  );
  check(
    normalized(t.from, 20) === normalized(r.from, 20) &&
      normalized(t.to, 20) === normalized(r.to, 20),
  );
  check(
    [0n, 1n].includes(quantity(r.status)) &&
      quantity(b.timestamp) <= 253402300799n,
  );
  return {
    tx,
    blockHash,
    index: Number(index),
    timestamp: Number(quantity(b.timestamp)),
    status: quantity(r.status) === 1n ? "success" : "failed",
  };
}
export function deriveDeposit(source, logIndex) {
  const mined = validateMined(source, 1);
  check(mined.status === "success", "Failed source transaction");
  check(
    Number.isSafeInteger(logIndex) && logIndex >= 0 && logIndex <= 0xffffffff,
    "Invalid global log index",
  );
  const logs = source.receipt.logs;
  check(
    Array.isArray(logs) && logs.length === 1,
    "Supply only the selected Portal log",
  );
  const matches = logs.filter((l) => quantity(l.logIndex) === BigInt(logIndex));
  check(matches.length === 1, "Select exactly one supplied log");
  const log = matches[0];
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
  check(
    log.removed === false && normalized(log.address, 20) === PORTAL,
    "Wrong portal or removed log",
  );
  check(
    normalized(log.transactionHash, 32) === mined.tx &&
      normalized(log.blockHash, 32) === mined.blockHash,
  );
  check(
    quantity(log.blockNumber) === quantity(source.block.number) &&
      quantity(log.transactionIndex) === BigInt(mined.index),
  );
  check(
    Array.isArray(log.topics) &&
      log.topics.length === 4 &&
      normalized(log.topics[0], 32) === DEPOSIT_TOPIC,
  );
  const from = bytes(log.topics[1], 32),
    to = bytes(log.topics[2], 32);
  check(
    from.slice(0, 12).every((x) => x === 0) &&
      to.slice(0, 12).every((x) => x === 0),
  );
  check(
    integer(bytes(log.topics[3], 32)) === 0n,
    "Unsupported deposit version",
  );
  const data = bytes(log.data);
  check(data.length >= 160 && data.length % 32 === 0);
  check(integer(data.slice(0, 32)) === 32n, "Invalid ABI offset");
  const length = integer(data.slice(32, 64));
  check(
    length >= 73n &&
      length <= BigInt(data.length - 64) &&
      BigInt(data.length - 64) < length + 32n,
    "Invalid opaque data length",
  );
  const payload = data.slice(64, 64 + Number(length));
  check(
    data.slice(64 + Number(length)).every((x) => x === 0),
    "Nonzero ABI padding",
  );
  check(payload[72] === 0, "Contract-creation deposits unsupported");
  const mint = integer(payload.slice(0, 32)),
    value = integer(payload.slice(32, 64)),
    gas = integer(payload.slice(64, 72));
  check(gas >= 21000n, "Invalid deposit gas");
  const sourceHash = hash(
    join(
      word(0n),
      bytes(hash(join(bytes(mined.blockHash, 32), word(BigInt(logIndex)))), 32),
    ),
  );
  const fields = [
    bytes(sourceHash, 32),
    from.slice(12),
    to.slice(12),
    uint(mint),
    uint(value),
    uint(gas),
    new Uint8Array(),
    payload.slice(73),
  ];
  const transactionHash = hash(join(Uint8Array.of(0x7e), rlp(fields)));
  return {
    sourceHash,
    transactionHash,
    from: hex(from.slice(12)),
    to: hex(to.slice(12)),
    mintWei: mint.toString(),
    valueWei: value.toString(),
    gasLimit: gas.toString(),
    data: hex(payload.slice(73)),
    logIndex,
  };
}
function same(actual, expected, message) {
  check(actual === expected, message);
}
export function buildBridgeCase(bundle) {
  keys(bundle, ["schema", "synthetic", "logIndex", "source", "destination"]);
  check(
    bundle.schema === "positano.op-deposit-bundle.v1" &&
      typeof bundle.synthetic === "boolean",
  );
  const source = bundle.source,
    destination = bundle.destination;
  const derived = deriveDeposit(source, bundle.logIndex),
    a = validateMined(source, 1),
    b = validateMined(destination, 10);
  const t = destination.transaction;
  same(
    b.tx,
    derived.transactionHash,
    "Derived L2 hash does not match supplied transaction",
  );
  same(quantity(t.type), 126n, "Not an OP deposit transaction");
  same(
    normalized(t.sourceHash, 32),
    derived.sourceHash,
    "Source hash mismatch",
  );
  same(normalized(t.from, 20), derived.from, "Deposit sender mismatch");
  same(normalized(t.to, 20), derived.to, "Deposit target mismatch");
  same(
    quantity(t.mint ?? "0x0").toString(),
    derived.mintWei,
    "Deposit mint mismatch",
  );
  same(
    quantity(t.value).toString(),
    derived.valueWei,
    "Deposit value mismatch",
  );
  same(quantity(t.gas).toString(), derived.gasLimit, "Deposit gas mismatch");
  check(
    t.isSystemTx === false || t.isSystemTx === undefined,
    "System deposits unsupported",
  );
  same(normalized(t.input), derived.data, "Deposit calldata mismatch");
  check(b.timestamp >= a.timestamp, "Destination precedes source");
  const sourceId = "eip155:1:" + a.tx,
    destinationId = "eip155:10:" + b.tx;
  return {
    schema: "positano.bridge-case.v1",
    network: "cross",
    synthetic: bundle.synthetic,
    coverage:
      "Ethereum (chain 1) to OP Mainnet (chain 10), one version-0 Portal deposit. Exact L2 transaction hash derived from supplied L1 event. RPC fields and block references cross-checked, not authenticated chain proofs or finality verification. This is a deposit-execution link, not decoded token flows, complete asset recovery, or common ownership.",
    nodes: [
      { id: sourceId, network: "eth", kind: "transaction" },
      { id: destinationId, network: "op", kind: "transaction" },
    ],
    edges: [
      {
        id: derived.sourceHash,
        from: sourceId,
        to: destinationId,
        kind: "derived_op_deposit",
        amount: derived.mintWei,
        unit: "wei minted by deposit",
        timestamp: a.timestamp,
        source: "https://etherscan.io/tx/" + a.tx,
      },
    ],
    bridge: {
      protocol: "op-portal-v0",
      sourceChainId: "1",
      destinationChainId: "10",
      portal: PORTAL,
      ...derived,
      sourceTransaction: a.tx,
      destinationTransaction: b.tx,
      sourceBlock: a.blockHash,
      destinationBlock: b.blockHash,
      sourceTimestamp: a.timestamp,
      destinationTimestamp: b.timestamp,
      destinationStatus: b.status,
      transferredTopLevelWei: b.status === "success" ? derived.valueWei : "0",
    },
    evidence: bundle,
  };
}
