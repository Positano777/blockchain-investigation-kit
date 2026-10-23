import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto, createHash } from "node:crypto";
import { buildSolanaCase } from "../web/solana.mjs";
import { verifyCase, canonical, filterEdges } from "../web/case.mjs";
const load = (name) =>
  JSON.parse(readFileSync(new URL("../" + name, import.meta.url), "utf8"));
const fixture = () => load("examples/solana-transfers.synthetic.json");
const seal = (d) => {
  const content = buildSolanaCase(d);
  return {
    ...content,
    digest:
      "sha256:" + createHash("sha256").update(canonical(content)).digest("hex"),
  };
};
test("All Solana examples reconstruct and verify", async () => {
  for (const name of [
    "solana",
    "solana-token",
    "solana-lab",
    "solana-failed",
  ]) {
    const d = load("web/" + name + "-case.json");
    assert.equal(await verifyCase(d, webcrypto), d);
    const { digest, ...content } = d;
    assert.deepEqual(buildSolanaCase(d.solanaEvidence), content);
  }
});
test("Exact u64 token and lamport values never use floating-point arithmetic", () => {
  const d = buildSolanaCase(fixture());
  assert.equal(d.edges[1].amount, "18446744073709551615");
  assert.equal(
    d.solanaAnalysis.balanceObservations[0].preLamports,
    "9007199254740993",
  );
  assert.equal(d.solanaAnalysis.balanceObservations[0].deltaLamports, "-5000");
  assert.equal(d.solanaAnalysis.feeLamports, "5000");
});
test("Only successful top-level transfers are committed; inner success is not guessed", () => {
  const d = buildSolanaCase(fixture());
  assert.deepEqual(
    d.edges.map((e) => e.outcome),
    ["committed", "committed", "inner_outcome_unverified"],
  );
  assert.deepEqual(d.edges[2].evidenceRef, {
    kind: "provider_parsed_instruction",
    index: 0,
    innerIndex: 0,
    programId: fixture().topInstructions[1].programId,
  });
  assert.equal(d.solanaAnalysis.unsupportedInstructions, 1);
});
test("Failed transaction instruction amounts are never committed", () => {
  const d = buildSolanaCase(load("examples/solana-failed.synthetic.json"));
  assert.ok(d.edges.every((e) => e.outcome === "not_committed"));
  assert.equal(d.solanaAnalysis.status, "failed");
  assert.equal(d.solanaAnalysis.feeLamports, "5000");
});
test("Missing inner metadata is distinct from an empty supplied list", () => {
  const f = fixture();
  f.innerInstructions = null;
  assert.equal(buildSolanaCase(f).solanaAnalysis.innerCoverage, "not_supplied");
  f.innerInstructions = [];
  assert.equal(buildSolanaCase(f).solanaAnalysis.innerCoverage, "supplied");
});
test("Unsupported-only transaction still has fee and balance observations, no invented edges", () => {
  const f = fixture();
  f.topInstructions = f.topInstructions.map((row) => ({
    programId: row.programId,
    kind: "unsupported",
  }));
  f.innerInstructions = [];
  const d = buildSolanaCase(f);
  assert.equal(d.edges.length, 0);
  assert.equal(d.solanaAnalysis.unsupportedInstructions, 3);
  assert.equal(d.solanaAnalysis.balanceObservations.length, 5);
});
test("Program substitution, unknown accounts, unsafe amounts, versions, and duplicate inner indices fail", () => {
  for (const mutate of [
    (f) => (f.topInstructions[0].programId = f.accounts[2].address),
    (f) => (f.topInstructions[0].source = "1"),
    (f) => (f.topInstructions[0].amount = 123),
    (f) => (f.topInstructions[0].amount = "18446744073709551616"),
    (f) => (f.version = 1),
    (f) => f.innerInstructions.push(f.innerInstructions[0]),
    (f) => (f.topInstructions[1].decimals = 256),
    (f) => (f.accounts[0].signer = false),
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => buildSolanaCase(f));
  }
});
test("Recomputed checksum cannot legitimize changed derived outcomes or references", async () => {
  for (const mutate of [
    (d) => (d.edges[2].outcome = "committed"),
    (d) => (d.edges[0].evidenceRef.index = 9),
    (d) => (d.solanaAnalysis.feeLamports = "0"),
    (d) => (d.solanaEvidence.providerDiagnostic = "not retained"),
    (d) => (d.edges[0].source = "javascript:alert(1)"),
  ]) {
    const d = seal(fixture());
    mutate(d);
    const { digest, ...content } = d;
    d.digest =
      "sha256:" + createHash("sha256").update(canonical(content)).digest("hex");
    await assert.rejects(() => verifyCase(d, webcrypto));
  }
});
test("Solana filtering retains exact token units and instruction IDs", () => {
  const d = seal(fixture());
  assert.equal(filterEdges(d, { kind: "token_transfer" }).length, 2);
  assert.equal(filterEdges(d, { query: ":inner:0" }).length, 1);
});
