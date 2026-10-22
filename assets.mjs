import { readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { buildAssetCase } from "./web/movements.mjs";
import { canonical } from "./web/case.mjs";
try {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error("Use INPUT NEW_OUTPUT");
  if ((await stat(input)).size > 2_000_000)
    throw new Error("Input exceeds 2 MB");
  const raw = await readFile(input);
  if (raw.length > 2_000_000) throw new Error("Input exceeds 2 MB");
  const content = buildAssetCase(JSON.parse(raw.toString("utf8"))),
    digest =
      "sha256:" + createHash("sha256").update(canonical(content)).digest("hex");
  const text = JSON.stringify({ ...content, digest }, null, 2) + "\n";
  if (Buffer.byteLength(text) > 2_000_000) throw new Error("Case exceeds 2 MB");
  await writeFile(output, text, { flag: "wx" });
  console.log("Asset evidence case saved.");
} catch (error) {
  console.error("Asset case failed: " + error.message);
  process.exitCode = 1;
}
