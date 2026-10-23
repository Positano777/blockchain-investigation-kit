import validation from "./network-validation.json" with {type:"json"};
export const EVM_VALIDATION=Object.freeze(validation.map(row=>Object.freeze(row)));
import registry from "./networks.json" with { type: "json" };
export const EVM_NETWORKS = Object.freeze(
  registry.map((row) => Object.freeze(row)),
);
export function evmNetwork(chain) {
  const id =
    typeof chain === "string" && /^0x[0-9a-f]+$/i.test(chain)
      ? BigInt(chain)
      : chain;
  const row = EVM_NETWORKS.find((row) => String(row.chainId) === String(id));
  if (!row) throw new Error("Unsupported EVM chain.");
  return row;
}
export function formatNative(amount, chain) {
  if (typeof amount === "number" && !Number.isSafeInteger(amount))
    throw new Error("Unsafe native amount.");
  const row = evmNetwork(chain),
    value = BigInt(amount);
  if (value < 0n) throw new Error("Negative native amount.");
  const scale = 10n ** BigInt(row.decimals),
    fraction = (value % scale)
      .toString()
      .padStart(row.decimals, "0")
      .replace(/0+$/, "");
  return (
    String(value / scale) + (fraction ? "." + fraction : "") + " " + row.symbol
  );
}
