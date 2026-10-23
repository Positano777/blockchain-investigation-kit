import { canonical, verifyCase } from "./case.mjs";
// Compare provider snapshots, never silently merge conflicting evidence.
export async function compareBitcoinCases(
  current,
  other,
  crypto = globalThis.crypto,
) {
  await verifyCase(current, crypto);
  await verifyCase(other, crypto);
  if (
    current.schema !== "positano.bitcoin-investigation.v1" ||
    other.schema !== current.schema ||
    current.evidence.transaction.txid !== other.evidence.transaction.txid
  )
    throw new Error("Compare two Bitcoin cases for the same root transaction.");
  if (current.synthetic !== other.synthetic)
    throw new Error("Synthetic and mainnet cases cannot be compared.");
  const a = current.evidence,
    b = other.evidence;
  const immutable = (tx) => {
    const { status, ...content } = tx;
    return content;
  };
  const conflicts = [];
  if (
    canonical(immutable(a.transaction)) !== canonical(immutable(b.transaction))
  )
    conflicts.push(
      "Root inputs, outputs, scripts, or fee differ for the same reported transaction ID.",
    );
  const changes = [];
  if (canonical(a.transaction.status) !== canonical(b.transaction.status))
    changes.push({
      kind: "root_status_changed",
      current: a.transaction.status,
      comparison: b.transaction.status,
    });
  const count = Math.min(a.outspends.length, b.outspends.length);
  for (let index = 0; index < count; index++) {
    const from = a.outspends[index],
      to = b.outspends[index];
    if (canonical(from) !== canonical(to)) {
      changes.push({
        kind: "output_spend_observation_changed",
        output: index,
        current: from,
        comparison: to,
      });
      if (
        from.spent &&
        to.spent &&
        (from.txid !== to.txid || from.vin !== to.vin)
      )
        conflicts.push(
          `Output ${index} has different reported spending references. This may reflect replacement, reorganization, or provider disagreement.`,
        );
    }
  }
  for (const first of a.spendingTransactions) {
    const second = b.spendingTransactions.find(
      (row) => row.txid === first.txid,
    );
    if (second && canonical(immutable(first)) !== canonical(immutable(second)))
      conflicts.push(
        "Spending transaction data differs for " + first.txid + ".",
      );
  }
  return {
    schema: "positano.bitcoin-comparison.v1",
    transaction: a.transaction.txid,
    currentDigest: current.digest,
    comparisonDigest: other.digest,
    currentCapturedAt: a.capturedAt,
    comparisonCapturedAt: b.capturedAt,
    conflicts,
    changes,
    coverage:
      "Comparison of two supplied provider snapshots, labeled current and comparison, not assumed chronological. Differences are observations, not proof of theft, ownership, finality, or a complete transaction history. No evidence was merged.",
  };
}
