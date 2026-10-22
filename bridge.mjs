import { open, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { buildBridgeCase, deriveDeposit } from "./web/bridge.mjs";
import { canonical } from "./web/case.mjs";
async function load(path) {
  const file = await open(path, "r");
  try {
    const buffer = Buffer.alloc(2_000_001);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (bytesRead > 2_000_000) throw new Error("Input too large");
    return JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
  } finally {
    await file.close();
  }
}
try {
  const [mode, input, output] = process.argv.slice(2);
  if (mode === "derive")
    console.log(
      JSON.stringify(deriveDeposit(await load(input), Number(output))),
    );
  else if (mode === "build") {
    const content = buildBridgeCase(await load(input));
    const digest =
      "sha256:" + createHash("sha256").update(canonical(content)).digest("hex");
    const data = JSON.stringify({ ...content, digest }, null, 2) + "\n";
    if (Buffer.byteLength(data) > 2_000_000)
      throw new Error("Output too large");
    await writeFile(output, data, { flag: "wx" });
    console.log("Cross-network case saved.");
  } else
    throw new Error("Use derive INPUT LOG_INDEX or build INPUT NEW_OUTPUT");
} catch (error) {
  console.error("Bridge case failed: " + error.message);
  process.exitCode = 1;
}
