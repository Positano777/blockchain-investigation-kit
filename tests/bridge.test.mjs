import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import {
  buildBridgeCase,
  deriveDeposit,
  hash,
  rlp,
  hex,
  bytes,
  DEPOSIT_TOPIC,
} from "../web/bridge.mjs";
import { verifyCase, validateCase, canonical } from "../web/case.mjs";
const load = (path) =>
  JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const bundle = () => load("examples/op-deposit.mainnet.json");
const stored = () => load("web/bridge-case.json");
test("Keccak and RLP independent known vectors", () => {
  assert.equal(
    hash(new Uint8Array()),
    "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
  );
  assert.equal(hex(rlp(new TextEncoder().encode("dog"))), "0x83646f67");
  assert.equal(
    hex(
      rlp([new TextEncoder().encode("cat"), new TextEncoder().encode("dog")]),
    ),
    "0xc88363617483646f67",
  );
  assert.equal(hex(rlp(new Uint8Array())), "0x80");
});
test("real source log derives independently captured L2 transaction", async () => {
  const b = bundle(),
    derived = deriveDeposit(b.source, b.logIndex);
  assert.equal(
    derived.transactionHash,
    "0x1280b561a1ba4e1c7c0294c92f884056ac89f77bb2d28f4e2030a689d45b98e1",
  );
  assert.equal(derived.sourceHash, b.destination.transaction.sourceHash);
  assert.equal(derived.mintWei, "4023132372820432805");
  const { digest, ...content } = stored();
  assert.deepEqual(content, buildBridgeCase(b));
  await verifyCase(stored(), webcrypto);
});
test("chains, portal, removed and version fail closed", () => {
  const mutations = [
    (b) => (b.source.chainId = "0xa"),
    (b) => (b.destination.chainId = "0x1"),
    (b) => (b.source.receipt.logs[0].address = "0x" + "a".repeat(40)),
    (b) => (b.source.receipt.logs[0].removed = true),
    (b) => (b.source.receipt.logs[0].topics[3] = "0x" + "0".repeat(63) + "1"),
  ];
  for (const mutate of mutations) {
    const b = bundle();
    mutate(b);
    assert.throws(() => buildBridgeCase(b));
  }
});
test("global log identity determines deposit and rejects mismatch", () => {
  const b = bundle();
  assert.throws(() => deriveDeposit(b.source, b.logIndex + 1));
  b.source.receipt.logs[0].logIndex = "0x" + (b.logIndex + 1).toString(16);
  b.logIndex++;
  assert.notEqual(
    deriveDeposit(b.source, b.logIndex).sourceHash,
    stored().bridge.sourceHash,
  );
  assert.throws(() => buildBridgeCase(b));
});
test("transaction, receipt and block must agree on both chains", () => {
  for (const chain of ["source", "destination"])
    for (const field of [
      "blockHash",
      "transactionHash",
      "transactionIndex",
      "from",
      "status",
    ]) {
      const b = bundle();
      b[chain].receipt[field] =
        field === "status"
          ? "0x2"
          : field === "transactionIndex"
            ? "0x1234"
            : field === "from"
              ? "0x" + "a".repeat(40)
              : "0x" + "f".repeat(64);
      assert.throws(() => buildBridgeCase(b), `${chain} ${field}`);
    }
});
test("ABI offset, length, padding and event signature validated", () => {
  const mutateByte = (b, index, value) => {
    const raw = bytes(b.source.receipt.logs[0].data);
    raw[index] = value;
    b.source.receipt.logs[0].data = hex(raw);
  };
  for (const mutate of [
    (b) => mutateByte(b, 31, 64),
    (b) => mutateByte(b, 63, 255),
    (b) => mutateByte(b, 159, 1),
    (b) => (b.source.receipt.logs[0].topics[0] = "0x" + "f".repeat(64)),
  ]) {
    const b = bundle();
    mutate(b);
    assert.throws(() => buildBridgeCase(b));
  }
  assert.equal(bundle().source.receipt.logs[0].topics[0], DEPOSIT_TOPIC);
});
test("contract creation, invalid topic address and duplicate logs rejected", () => {
  const b = bundle(),
    data = bytes(b.source.receipt.logs[0].data);
  data[64 + 72] = 1;
  b.source.receipt.logs[0].data = hex(data);
  assert.throws(() => buildBridgeCase(b));
  const c = bundle();
  c.source.receipt.logs[0].topics[1] =
    "0x01" + c.source.receipt.logs[0].topics[1].slice(4);
  assert.throws(() => buildBridgeCase(c));
  const d = bundle();
  d.source.receipt.logs.push(d.source.receipt.logs[0]);
  assert.throws(() => buildBridgeCase(d));
});
test("failed destination retains mint but does not assert call value delivery", () => {
  const b = bundle();
  b.destination.receipt.status = "0x0";
  const c = buildBridgeCase(b);
  assert.equal(c.bridge.destinationStatus, "failed");
  assert.equal(c.bridge.transferredTopLevelWei, "0");
  assert.equal(c.bridge.mintWei, "4023132372820432805");
  b.source.receipt.status = "0x0";
  assert.throws(() => buildBridgeCase(b));
});
test("destination deposit fields checked, not only transaction hash", () => {
  const mutations = [
    (b) => (b.destination.transaction.sourceHash = "0x" + "f".repeat(64)),
    (b) => (b.destination.transaction.type = "0x2"),
    (b) => (b.destination.transaction.value = "0x1"),
    (b) => (b.destination.transaction.mint = "0x1"),
    (b) => (b.destination.transaction.gas = "0x1"),
    (b) => (b.destination.transaction.input = "0x12"),
    (b) => (b.destination.transaction.isSystemTx = true),
  ];
  for (const mutate of mutations) {
    const b = bundle();
    mutate(b);
    assert.throws(() => buildBridgeCase(b));
  }
});
test("case link and source URL cannot be altered with a fresh checksum", () => {
  for (const mutate of [
    (d) => (d.edges[0].source = "javascript:alert(1)"),
    (d) => (d.nodes[1].network = "eth"),
    (d) => (d.bridge.mintWei = "1"),
  ]) {
    const d = stored();
    mutate(d);
    const { digest, ...content } = d;
    d.digest =
      "sha256:" + createHash("sha256").update(canonical(content)).digest("hex");
    assert.throws(() => validateCase(d));
  }
});
test("unknown provider diagnostics cannot enter an evidence bundle", () => {
  const b = bundle();
  b.source.transaction.rpcUrl = "secret";
  assert.throws(() => buildBridgeCase(b));
});
test("vendored hash modules match recorded provenance", () => {
  const p = load("web/vendor/noble-hashes/PROVENANCE.json");
  for (const [name, entry] of Object.entries(p.files))
    assert.equal(
      createHash("sha256")
        .update(
          readFileSync(
            new URL("../web/vendor/noble-hashes/" + name, import.meta.url),
          ),
        )
        .digest("hex"),
      entry.vendoredSha256,
    );
});
