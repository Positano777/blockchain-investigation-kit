import test from "node:test";
import assert from "node:assert/strict";
import { evidenceCard } from "../web/share.mjs";
import { readFileSync } from "node:fs";
test("Evidence card retains provenance and excludes annotations and external assets", () => {
  const d = JSON.parse(
    readFileSync(new URL("../web/bitcoin-case.json", import.meta.url)),
  );
  d.note = "PRIVATE ANALYST NOTE";
  const svg = evidenceCard(d);
  assert.ok(svg.includes(d.digest));
  assert.ok(svg.includes("Provider-reported"));
  assert.ok(svg.includes("0 satoshi fee"));
  assert.ok(!svg.includes(d.note));
  assert.ok(!/<script|<image|href=/.test(svg));
  assert.ok(svg.includes("No ownership or finality claim"));
  d.synthetic = true;
  assert.ok(evidenceCard(d).includes("Synthetic example"));
});
test("Evidence card escapes XML", () => {
  const d = {
    network: "eth",
    nodes: [],
    edges: [],
    digest: 'sha256:<script>&"',
    coverage: "",
  };
  assert.ok(evidenceCard(d).includes("&lt;script&gt;&amp;&quot;"));
  assert.ok(!evidenceCard(d).includes("<script>"));
});
