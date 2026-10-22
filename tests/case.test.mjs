import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import {
  verifyCase,
  validateCase,
  canonical,
  filterEdges,
  formatEth,
} from "../web/case.mjs";
const fixture = (name) =>
  JSON.parse(
    readFileSync(new URL("../web/" + name + "-case.json", import.meta.url)),
  );
const resign = (d) => {
  const { digest, ...content } = d;
  d.digest =
    "sha256:" + createHash("sha256").update(canonical(content)).digest("hex");
  return d;
};
test("all Python-generated cases verify in JavaScript", async () => {
  for (const name of ["eth", "sol", "real"])
    assert.equal(
      await verifyCase(fixture(name), webcrypto).then((x) => x.network),
      name === "sol" ? "sol" : "eth",
    );
});
test("tampering fails checksum", async () => {
  const d = fixture("eth");
  d.edges[0].amount = "1";
  await assert.rejects(verifyCase(d, webcrypto), /checksum mismatch/);
});
test("active URLs rejected even with matching checksum", () => {
  const d = fixture("eth");
  d.edges[0].source = "javascript:alert(1)";
  assert.throws(() => validateCase(resign(d)));
});
test("dangling and duplicate evidence rejected", () => {
  const d = fixture("eth");
  d.edges.push(d.edges[0]);
  assert.throws(() => validateCase(d));
  const e = fixture("eth");
  e.edges[0].to = "0x" + "f".repeat(40);
  assert.throws(() => validateCase(e));
});
test("unsafe field injection rejected", () => {
  const d = fixture("eth");
  d.title = "<script>alert(1)</script>";
  assert.throws(() => validateCase(d));
});
test("fee arithmetic and execution fields validated", () => {
  const d = fixture("real");
  d.receipt.totalFeeWei = "1";
  assert.throws(() => validateCase(d));
  const e = fixture("real");
  e.edges[0].amount = "1";
  assert.throws(() => validateCase(e));
});
test("search, kind, date bounds and missing times", () => {
  const d = fixture("eth");
  assert.equal(filterEdges(d, { query: d.nodes[0].id }).length, 1);
  assert.equal(filterEdges(d, { kind: "rpc_call" }).length, 0);
  assert.equal(
    filterEdges(d, { from: "2026-10-21", until: "2026-10-21" }).length,
    2,
  );
  assert.equal(filterEdges(fixture("sol"), { from: "2020-01-01" }).length, 0);
});
test("large wei formatting stays exact", () => {
  assert.equal(
    formatEth("123456789012345678901234567890"),
    "123456789012.34567890123456789 ETH",
  );
  assert.equal(formatEth("0"), "0 ETH");
});
test("receipt call cannot omit its summary", () => {
  const d = fixture("real");
  delete d.receipt;
  assert.throws(() => validateCase(d));
});
test("assembled receipt cases verify and keep block order", async () => {
  const d = fixture("multi");
  await verifyCase(d, webcrypto);
  assert.equal(d.edges.length, 2);
  assert.equal(filterEdges(d)[0].id, fixture("real").edges[0].id);
});
test("assembled cases require matching receipt map and source references", () => {
  const d = fixture("multi");
  delete d.receipts[d.edges[0].id];
  assert.throws(() => validateCase(d));
  const e = fixture("multi");
  e.sources.pop();
  assert.throws(() => validateCase(e));
  const f = fixture("multi");
  f.sources.push(f.sources[0]);
  assert.throws(() => validateCase(f));
});
test("assembled receipt summaries cannot misstate fee or execution", () => {
  const d = fixture("multi");
  d.receipts[d.edges[0].id].totalFeeWei = "1";
  assert.throws(() => validateCase(d));
  const e = fixture("multi");
  e.receipt = fixture("real").receipt;
  assert.throws(() => validateCase(e));
});
