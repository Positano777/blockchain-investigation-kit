// Reconstruct a portable case from projected, provider-parsed Solana instructions.
const GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
const SYSTEM = "11111111111111111111111111111111";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
function check(ok) {
  if (!ok) throw new Error("Invalid Solana transaction evidence.");
}
function keys(value, names) {
  check(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === names.length &&
      names.every((k) => Object.hasOwn(value, k)),
  );
}
export function solanaId(value, size = 32) {
  check(typeof value === "string" && value.length >= 1 && value.length <= 90);
  let number = 0n;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  for (const char of value) {
    const digit = alphabet.indexOf(char);
    check(digit >= 0);
    number = number * 58n + BigInt(digit);
  }
  let bytes = 0;
  while (number > 0n) {
    bytes++;
    number >>= 8n;
  }
  check(bytes + value.length - value.replace(/^1+/, "").length === size);
  return value;
}
function integer(v, max = Number.MAX_SAFE_INTEGER) {
  check(Number.isSafeInteger(v) && v >= 0 && v <= max);
  return v;
}
function amount(v) {
  check(
    typeof v === "string" &&
      /^(?:0|[1-9][0-9]{0,19})$/.test(v) &&
      BigInt(v) <= 18446744073709551615n,
  );
  return v;
}
export function buildSolanaCase(d) {
  keys(d, [
    "schema",
    "network",
    "genesisHash",
    "syntheticExample",
    "capturedAt",
    "signature",
    "slot",
    "blockTime",
    "version",
    "requestedCommitment",
    "feeLamports",
    "success",
    "accounts",
    "topInstructions",
    "innerInstructions",
  ]);
  check(
    d.schema === "positano.solana-transaction.v1" &&
      d.network === "solana-mainnet" &&
      d.genesisHash === GENESIS &&
      typeof d.syntheticExample === "boolean",
  );
  check(
    typeof d.capturedAt === "string" &&
      d.capturedAt.length <= 40 &&
      /^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d)$/.test(d.capturedAt) &&
      Number.isFinite(Date.parse(d.capturedAt)),
  );
  const signature = solanaId(d.signature, 64);
  integer(d.slot);
  if (d.blockTime !== null) integer(d.blockTime, 253402300799);
  check(d.version === "legacy" || d.version === 0);
  check(
    d.requestedCommitment === "finalized" && typeof d.success === "boolean",
  );
  amount(d.feeLamports);
  check(
    Array.isArray(d.accounts) &&
      d.accounts.length >= 1 &&
      d.accounts.length <= 256,
  );
  const addresses = new Set(),
    nodes = [],
    observations = [];
  for (const account of d.accounts) {
    keys(account, [
      "address",
      "signer",
      "writable",
      "preLamports",
      "postLamports",
    ]);
    const address = solanaId(account.address);
    check(
      !addresses.has(address) &&
        typeof account.signer === "boolean" &&
        typeof account.writable === "boolean",
    );
    addresses.add(address);
    amount(account.preLamports);
    amount(account.postLamports);
    nodes.push({
      id: "solana-mainnet:account:" + address,
      network: "solana-mainnet",
      kind: "account",
    });
    observations.push({
      ...account,
      deltaLamports: String(
        BigInt(account.postLamports) - BigInt(account.preLamports),
      ),
    });
  }
  check(d.accounts[0].signer && d.accounts[0].writable);
  check(
    Array.isArray(d.topInstructions) &&
      d.topInstructions.length >= 1 &&
      d.topInstructions.length <= 128,
  );
  check(
    d.innerInstructions === null ||
      (Array.isArray(d.innerInstructions) &&
        d.innerInstructions.length <= d.topInstructions.length),
  );
  const edges = [];
  let unsupported = 0,
    total = d.topInstructions.length,
    innerSupported = 0;
  function decode(row, index, innerIndex) {
    check(row && addresses.has(solanaId(row.programId)));
    if (row.kind === "unsupported") {
      keys(row, ["programId", "kind"]);
      unsupported++;
      return;
    }
    if (row.kind === "sol_transfer") {
      keys(row, ["programId", "kind", "source", "destination", "amount"]);
      check(row.programId === SYSTEM);
    } else {
      check(row.kind === "token_transfer" && row.programId === TOKEN);
      keys(row, [
        "programId",
        "kind",
        "source",
        "destination",
        "amount",
        "mint",
        "decimals",
      ]);
      if (row.mint !== null) solanaId(row.mint);
      if (row.decimals !== null) {
        integer(row.decimals, 255);
        check(row.mint !== null);
      }
    }
    check(
      addresses.has(solanaId(row.source)) &&
        addresses.has(solanaId(row.destination)),
    );
    amount(row.amount);
    const outcome = !d.success
      ? "not_committed"
      : innerIndex === null
        ? "committed"
        : "inner_outcome_unverified";
    if (innerIndex !== null) innerSupported++;
    edges.push({
      id:
        signature +
        ":instruction:" +
        index +
        (innerIndex === null ? "" : ":inner:" + innerIndex),
      from: "solana-mainnet:account:" + row.source,
      to: "solana-mainnet:account:" + row.destination,
      kind: row.kind,
      amount: row.amount,
      unit: row.kind === "sol_transfer" ? "lamports" : "raw_token_units",
      timestamp: d.blockTime,
      source: "https://solscan.io/tx/" + signature,
      outcome,
      evidenceRef: {
        kind: "provider_parsed_instruction",
        index,
        innerIndex,
        programId: row.programId,
      },
      ...(row.kind === "token_transfer"
        ? { assetMint: row.mint, decimals: row.decimals }
        : {}),
    });
  }
  d.topInstructions.forEach((row, index) => decode(row, index, null));
  let previous = -1;
  for (const group of d.innerInstructions || []) {
    keys(group, ["index", "instructions"]);
    integer(group.index, d.topInstructions.length - 1);
    check(group.index > previous);
    previous = group.index;
    check(Array.isArray(group.instructions));
    total += group.instructions.length;
    check(total <= 256);
    group.instructions.forEach((row, index) => decode(row, group.index, index));
  }
  return {
    schema: "positano.solana-case.v1",
    network: "solana-mainnet",
    synthetic: d.syntheticExample,
    coverage:
      "One provider-parsed Solana transaction. Top-level supported transfers are committed only when the whole transaction succeeds. Inner instruction outcomes are unverified; failed transaction instructions are not committed. Balance deltas are observations, not transfer edges. No signature/consensus proof, ownership, complete history, or pump.fun lifecycle decoding.",
    nodes,
    edges,
    solanaAnalysis: {
      signature,
      slot: d.slot,
      version: d.version,
      status: d.success ? "succeeded" : "failed",
      requestedCommitment: d.requestedCommitment,
      feeLamports: d.feeLamports,
      feePayer: d.accounts[0].address,
      unsupportedInstructions: unsupported,
      innerSupportedInstructions: innerSupported,
      innerCoverage: d.innerInstructions === null ? "not_supplied" : "supplied",
      balanceObservations: observations,
    },
    solanaEvidence: d,
  };
}
