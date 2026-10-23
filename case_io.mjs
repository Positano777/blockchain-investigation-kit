// Bounded stdin/stdout bridge for the Python local service; no shell evaluation.
import { createHash } from "node:crypto";
import { verifyCase, canonical } from "./web/case.mjs";
import { buildAssetCase } from "./web/movements.mjs";
try {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 2_000_000) throw new Error();
    chunks.push(chunk);
  }
  let data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (process.argv[2] === "assets") {
    const content = buildAssetCase(data);
    data = {
      ...content,
      digest:
        "sha256:" +
        createHash("sha256").update(canonical(content)).digest("hex"),
    };
  } else if (process.argv[2] === "validate") await verifyCase(data);
  else throw new Error();
  const output = JSON.stringify(data);
  if (Buffer.byteLength(output) > 2_000_000) throw new Error();
  process.stdout.write(output);
} catch {
  process.stderr.write("Case validation or conversion failed.\n");
  process.exitCode = 1;
}
