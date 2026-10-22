import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { buildAssetCase } from "../web/movements.mjs";
import { validateCase, verifyCase } from "../web/case.mjs";
const load = (p) =>
  JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const synthetic = () => load("examples/assets.synthetic.json");
test("saved real token events and explicit trace gap reproduce", async () => {
  const c = load("web/assets-case.json");
  await verifyCase(c, webcrypto);
  assert.equal(c.edges.length, 6);
  assert.equal(c.analysis.traceMissing, 1);
  assert.equal(c.analysis.traceAvailable, 0);
  assert.equal(c.edges.filter((e) => e.kind === "token_burn_event").length, 1);
});
test("synthetic trace lab distinguishes movements, inherited values, and reverted ancestors", async () => {
  const c = buildAssetCase(synthetic());
  await verifyCase(load("web/trace-case.json"), webcrypto);
  assert.equal(c.edges.filter((e) => e.kind === "native_value").length, 1);
  assert.equal(
    c.edges.filter((e) => e.kind === "internal_native_value").length,
    1,
  );
  assert.deepEqual(
    c.edges
      .filter((e) => e.kind === "attempted_internal_value")
      .map((e) => e.amount),
    ["5", "3"],
  );
  assert.ok(!c.edges.some((e) => e.amount === "99"));
  assert.equal(
    c.edges.find((e) => e.kind === "nft_transfer_event").tokenId,
    "7",
  );
  assert.equal(c.analysis.unsupportedTransferLogs, 1);
});
test("failed root reverts all descendant value and forbids persisted logs", () => {
  const b = synthetic();
  b.records[0].receipt.status = "0x0";
  b.records[0].trace.root.failed = true;
  b.records[0].receipt.logs = [];
  const c = buildAssetCase(b);
  assert.ok(c.edges.every((e) => e.outcome === "reverted"));
  b.records[0].receipt.logs = synthetic().records[0].receipt.logs;
  assert.throws(() => buildAssetCase(b));
});
test("wrong inclusion, duplicate logs, removed events rejected", () => {
  for (const mutate of [
    (b) => (b.records[0].receipt.blockHash = "0x" + "f".repeat(64)),
    (b) => (b.records[0].receipt.logs[0].removed = true),
    (b) => b.records[0].receipt.logs.push(b.records[0].receipt.logs[0]),
    (b) => b.records.push(b.records[0]),
  ]) {
    const b = synthetic();
    mutate(b);
    assert.throws(() => buildAssetCase(b));
  }
});
test("trace association and allowed frame types are checked", () => {
  for (const mutate of [
    (b) => (b.records[0].trace.root.from = "0x" + "f".repeat(40)),
    (b) => (b.records[0].trace.root.value = "0x1"),
    (b) => (b.records[0].trace.root.failed = true),
    (b) => (b.records[0].trace.root.calls[0].type = "BOGUS"),
  ]) {
    const b = synthetic();
    mutate(b);
    assert.throws(() => buildAssetCase(b));
  }
});
test("SELFDESTRUCT value is represented, CALLCODE inherited value is excluded", () => {
  const b = synthetic();
  b.records[0].trace.root.calls[0].type = "SELFDESTRUCT";
  const c = buildAssetCase(b);
  assert.equal(
    c.edges.filter((e) => e.kind === "internal_native_value").length,
    1,
  );
  b.records[0].trace.root.calls[0].type = "CALLCODE";
  assert.equal(
    buildAssetCase(b).edges.filter((e) => e.kind === "internal_native_value")
      .length,
    0,
  );
});
test("missing trace cannot carry an unvalidated root", () => {
  const b = synthetic();
  b.records[0].trace.status = "unavailable";
  assert.throws(() => buildAssetCase(b));
});
test("zero-result scan remains scoped negative evidence", async () => {
  const c = load("web/hop-case.json");
  await verifyCase(c, webcrypto);
  assert.equal(c.analysis.transactions, 0);
  assert.equal(c.nodes.length, 1);
  assert.equal(c.assetEvidence.discovery.scannedBlocks.length, 5);
  const b = structuredClone(c.assetEvidence);
  b.discovery.scannedBlocks.pop();
  assert.throws(() => buildAssetCase(b));
});
test("scan cap and record membership cannot be misrepresented", () => {
  const b = load("examples/after-bridge.mainnet.json");
  b.discovery.limitReached = true;
  assert.throws(() => buildAssetCase(b));
  const c = synthetic();
  c.discovery = load("examples/after-bridge.mainnet.json").discovery;
  assert.throws(() => buildAssetCase(c));
});
test("derived asset details and source links cannot override reconstruction", () => {
  const c = load("web/assets-case.json");
  c.edges[0].amount = "1";
  assert.throws(() => validateCase(c));
  const b = synthetic();
  b.records[0].trace.root.diagnostic = "secret";
  assert.throws(() => buildAssetCase(b));
});
