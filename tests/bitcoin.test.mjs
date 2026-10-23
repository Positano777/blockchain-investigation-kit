import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { buildBitcoinCase } from "../web/bitcoin.mjs";
import { verifyCase, caseEdges, filterEdges } from "../web/case.mjs";
const load = (name) =>
  JSON.parse(readFileSync(new URL("../" + name, import.meta.url), "utf8"));
const original = () => load("examples/bitcoin-investigation.mainnet.json");
test("Bitcoin Python case reconstructs and checksum verifies in JavaScript", async () => {
  const d = original();
  assert.equal(await verifyCase(d, webcrypto), d);
  const { digest, ...content } = d;
  assert.deepEqual(buildBitcoinCase(d.evidence), content);
  const edges = caseEdges(d);
  assert.equal(edges.length, 5);
  assert.equal(edges[0].amount, "5000000000");
  assert.ok(
    edges.every(
      (e) =>
        e.unit === "satoshis" &&
        e.source.startsWith("https://blockstream.info/tx/"),
    ),
  );
  assert.equal(filterEdges(d, { kind: "creates" }).length, 2);
});
test("Bitcoin evidence rejects incorrect fees, spends, scripts, and metadata", async () => {
  for (const mutate of [
    (d) => (d.evidence.transaction.fee = 1),
    (d) => (d.evidence.outspends[0].vin = 19),
    (d) =>
      (d.evidence.spendingTransactions[0].vin[0].prevout.scriptpubkey = "51"),
    (d) => (d.edges[0].satoshis = "1"),
    (d) => (d.source = "javascript:alert(1)"),
    (d) => (d.evidence.extra = "unprojected"),
  ]) {
    const d = original();
    mutate(d);
    await assert.rejects(() => verifyCase(d, webcrypto));
  }
});
test("Bitcoin rejects duplicate inputs, coinbase, unsafe integers, and wrong network", () => {
  for (const mutate of [
    (d) => d.transaction.vin.push(d.transaction.vin[0]),
    (d) => (d.transaction.vin[0].is_coinbase = true),
    (d) => (d.transaction.vout[0].value = true),
    (d) => (d.network = "bitcoin-testnet"),
    (d) => d.spendingTransactions.push(d.spendingTransactions[0]),
  ]) {
    const d = original().evidence;
    mutate(d);
    assert.throws(() => buildBitcoinCase(d));
  }
});
test("Unspent status remains scoped and unconfirmed time is absent", () => {
  const d = original().evidence;
  d.outspends = d.outspends.map(() => ({ spent: false }));
  d.spendingTransactions = [];
  d.transaction.status = { confirmed: false };
  const result = buildBitcoinCase(d);
  assert.equal(result.edges.length, 3);
  assert.ok(caseEdges(result).every((e) => e.timestamp === null));
  d.outspends[0].txid = "0".repeat(64);
  assert.throws(() => buildBitcoinCase(d));
});
