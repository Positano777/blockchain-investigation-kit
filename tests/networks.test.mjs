import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { EVM_NETWORKS, evmNetwork, formatNative } from "../web/networks.mjs";
import { buildAssetCase } from "../web/movements.mjs";
import { verifyCase } from "../web/case.mjs";
import { evidenceCard } from "../web/share.mjs";
const load = (name) =>
  JSON.parse(readFileSync(new URL("../" + name, import.meta.url), "utf8"));
test("Every registered EVM mainnet has a saved live fixture that reconstructs and verifies", async () => {
  const validation = load("web/network-validation.json");
  assert.equal(EVM_NETWORKS.length, 11);
  for (const profile of EVM_NETWORKS) {
    const result = validation.find((row) => row.chainId === profile.chainId);
    assert.equal(result.status, "mainnet_fixture");
    const d = load("web/" + result.fixture);
    await verifyCase(d, webcrypto);
    assert.equal(BigInt(d.assetEvidence.chainId), BigInt(profile.chainId));
    assert.equal(d.network, profile.key);
    assert.equal(d.synthetic, false);
    assert.equal(result.caseDigest, d.digest);
    assert.equal(d.assetEvidence.records.length, 1);
    assert.ok(
      d.nodes.every((node) => node.id.startsWith(`eip155:${profile.chainId}:`)),
    );
    assert.ok(
      d.edges.every((edge) => edge.source.startsWith(profile.explorerTx)),
    );
  }
});
test("Native labels and exact 18-decimal formatting stay chain-specific", () => {
  for (const profile of EVM_NETWORKS) {
    assert.equal(
      formatNative("1000000000000000001", profile.chainId),
      `1.000000000000000001 ${profile.symbol}`,
    );
    assert.equal(formatNative("0", profile.chainId), `0 ${profile.symbol}`);
    assert.equal(
      evmNetwork("0x" + profile.chainId.toString(16)).chainId,
      profile.chainId,
    );
  }
  assert.throws(() => formatNative(9007199254740993, 56));
  assert.throws(() => evmNetwork(999999));
});
test("Identical addresses on different chains do not share node identifiers", () => {
  const bundle = load("examples/evm-base.mainnet.json");
  const a = buildAssetCase(bundle);
  bundle.chainId = "0x38";
  const b = buildAssetCase(bundle);
  assert.ok(
    a.nodes.every((node) => !b.nodes.some((other) => other.id === node.id)),
  );
  assert.ok(
    b.edges.every((edge) => edge.source.startsWith("https://bscscan.com/tx/")),
  );
});
test("Unknown chain and metadata tampering fail shared validation", async () => {
  const d = load("web/evm-bsc-case.json");
  d.assetEvidence.chainId = "0xffff";
  await assert.rejects(() => verifyCase(d, webcrypto));
  const other = load("web/evm-bsc-case.json");
  other.network = "eth";
  await assert.rejects(() => verifyCase(other, webcrypto));
});
test("Non-ETH cards name the actual network and currency", () => {
  const d = load("web/evm-bsc-case.json");
  const card = evidenceCard(d);
  assert.ok(card.includes("BNB Smart Chain (BNB)"));
  assert.ok(card.includes(d.assetEvidence.records[0].transaction.hash));
});
