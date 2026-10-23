import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto, createHash } from "node:crypto";
import { compareBitcoinCases } from "../web/compare.mjs";
import { buildBitcoinCase } from "../web/bitcoin.mjs";
import { canonical } from "../web/case.mjs";
const original = () =>
  JSON.parse(
    readFileSync(new URL("../web/bitcoin-case.json", import.meta.url)),
  );
const seal = (evidence) => {
  const c = buildBitcoinCase(evidence);
  return {
    ...c,
    digest: "sha256:" + createHash("sha256").update(canonical(c)).digest("hex"),
  };
};
test("Same snapshot has no observed changes", async () => {
  const d = original();
  const result = await compareBitcoinCases(d, d, webcrypto);
  assert.equal(result.changes.length, 0);
  assert.equal(result.conflicts.length, 0);
});
test("Reported unspent to spent yields one difference with both digests", async () => {
  const d = original(),
    e = structuredClone(d.evidence);
  e.outspends[0] = { spent: false };
  e.spendingTransactions = e.spendingTransactions.filter(
    (tx) => tx.txid !== d.evidence.outspends[0].txid,
  );
  const before = seal(e),
    result = await compareBitcoinCases(before, d, webcrypto);
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].output, 0);
  assert.equal(result.currentDigest, before.digest);
  assert.equal(result.comparisonDigest, d.digest);
  assert.equal(result.conflicts.length, 0);
});
test("Provider input script disagreement is flagged without merging", async () => {
  const d = original(),
    e = structuredClone(d.evidence);
  e.transaction.vin[0].prevout.scriptpubkey = "51";
  const other = seal(e),
    result = await compareBitcoinCases(d, other, webcrypto);
  assert.equal(result.conflicts.length, 1);
  assert.equal(
    d.evidence.transaction.vin[0].prevout.scriptpubkey,
    original().evidence.transaction.vin[0].prevout.scriptpubkey,
  );
});
test("Tampered evidence and unrelated cases cannot be compared", async () => {
  const d = original(),
    bad = original();
  bad.edges[0].satoshis = "1";
  await assert.rejects(() => compareBitcoinCases(d, bad, webcrypto));
  const e = structuredClone(d.evidence);
  e.syntheticExample = true;
  await assert.rejects(() => compareBitcoinCases(d, seal(e), webcrypto));
});
