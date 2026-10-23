// Bitcoin provider-evidence reconstruction. No ownership or change heuristics.
const HASH = /^[0-9a-f]{64}$/;
const GENESIS =
  "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f";
const COVERAGE =
  "One supplied transaction and reported output spends at capture time. No ancestry crawl, ownership/change inference, consensus proof, or finality verification. Parent output amounts are provider-reported.";
function check(ok) {
  if (!ok) throw new Error("Invalid Bitcoin evidence.");
}
function hash(v) {
  check(typeof v === "string" && HASH.test(v));
  return v;
}
function integer(v, max = 2100000000000000) {
  check(Number.isSafeInteger(v) && v >= 0 && v <= max);
  return v;
}
function status(v) {
  check(v && typeof v.confirmed === "boolean");
  return v.confirmed
    ? {
        confirmed: true,
        block_height: integer(v.block_height, 10000000),
        block_hash: hash(v.block_hash),
        block_time: integer(v.block_time, 253402300799),
      }
    : { confirmed: false };
}
function output(v) {
  check(
    v &&
      typeof v.scriptpubkey === "string" &&
      v.scriptpubkey.length <= 20000 &&
      /^(?:[0-9a-f]{2})*$/.test(v.scriptpubkey),
  );
  return { scriptpubkey: v.scriptpubkey, value: integer(v.value) };
}
function transaction(v) {
  check(
    v &&
      Array.isArray(v.vin) &&
      v.vin.length >= 1 &&
      v.vin.length <= 20 &&
      Array.isArray(v.vout) &&
      v.vout.length >= 1 &&
      v.vout.length <= 20,
  );
  const txid = hash(v.txid),
    seen = new Set();
  const vin = v.vin.map((row) => {
    check(row && row.is_coinbase === false);
    const previous = hash(row.txid),
      index = integer(row.vout, 0xffffffff),
      key = previous + ":" + index;
    check(previous !== txid && !seen.has(key));
    seen.add(key);
    return {
      txid: previous,
      vout: index,
      is_coinbase: false,
      prevout: output(row.prevout),
    };
  });
  const vout = v.vout.map(output),
    fee = integer(v.fee);
  const input = vin.reduce((sum, row) => sum + BigInt(row.prevout.value), 0n),
    out = vout.reduce((sum, row) => sum + BigInt(row.value), 0n);
  check(
    input <= 2100000000000000n &&
      out <= 2100000000000000n &&
      input - out === BigInt(fee),
  );
  return { txid, vin, vout, fee, status: status(v.status) };
}
function equal(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
export function buildBitcoinCase(bundle) {
  check(
    bundle?.schema === "positano.bitcoin-utxo.v1" &&
      bundle.network === "bitcoin-mainnet" &&
      bundle.genesisHash === GENESIS &&
      typeof bundle.syntheticExample === "boolean",
  );
  check(
    typeof bundle.capturedAt === "string" &&
      bundle.capturedAt.length <= 40 &&
      /^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d)$/.test(bundle.capturedAt) &&
      Number.isFinite(Date.parse(bundle.capturedAt)),
  );
  const root = transaction(bundle.transaction),
    identifier = root.txid;
  check(
    Array.isArray(bundle.outspends) &&
      bundle.outspends.length === root.vout.length &&
      Array.isArray(bundle.spendingTransactions) &&
      bundle.spendingTransactions.length <= 20,
  );
  const spenders = new Map(),
    used = new Set();
  for (const row of bundle.spendingTransactions) {
    const item = transaction(row);
    check(item.txid !== identifier && !spenders.has(item.txid));
    spenders.set(item.txid, item);
  }
  const outspends = bundle.outspends.map((row, index) => {
    check(row && typeof row.spent === "boolean");
    if (!row.spent) {
      check(Object.keys(row).length === 1);
      return { spent: false };
    }
    const id = hash(row.txid),
      vin = integer(row.vin, 19),
      spender = spenders.get(id);
    check(spender && vin < spender.vin.length);
    const ref = spender.vin[vin];
    check(
      ref.txid === identifier &&
        ref.vout === index &&
        equal(ref.prevout, root.vout[index]) &&
        equal(status(row.status), spender.status),
    );
    if (spender.status.confirmed)
      check(
        root.status.confirmed &&
          spender.status.block_height >= root.status.block_height,
      );
    used.add(id);
    return { spent: true, txid: id, vin, status: spender.status };
  });
  check(used.size === spenders.size);
  const evidence = {
    schema: "positano.bitcoin-utxo.v1",
    network: "bitcoin-mainnet",
    genesisHash: GENESIS,
    syntheticExample: bundle.syntheticExample,
    capturedAt: bundle.capturedAt,
    transaction: root,
    outspends,
    spendingTransactions: [...spenders.keys()]
      .sort()
      .map((k) => spenders.get(k)),
  };
  const nodes = [{ id: "btc:tx:" + identifier, kind: "transaction" }],
    edges = [];
  root.vin.forEach((row, index) => {
    const point = row.txid + ":" + row.vout;
    nodes.push({ id: "btc:out:" + point, kind: "outpoint" });
    edges.push({
      from: "btc:out:" + point,
      to: "btc:tx:" + identifier,
      kind: "spends",
      satoshis: String(row.prevout.value),
      inputIndex: index,
    });
  });
  root.vout.forEach((row, index) => {
    const point = identifier + ":" + index;
    nodes.push({ id: "btc:out:" + point, kind: "outpoint" });
    edges.push({
      from: "btc:tx:" + identifier,
      to: "btc:out:" + point,
      kind: "creates",
      satoshis: String(row.value),
    });
    const observation = outspends[index];
    if (observation.spent) {
      const destination = "btc:tx:" + observation.txid;
      if (!nodes.some((n) => n.id === destination))
        nodes.push({ id: destination, kind: "transaction" });
      edges.push({
        from: "btc:out:" + point,
        to: destination,
        kind: "spends",
        satoshis: String(row.value),
        inputIndex: observation.vin,
      });
    }
  });
  return {
    schema: "positano.bitcoin-investigation.v1",
    network: "bitcoin-mainnet",
    synthetic: bundle.syntheticExample,
    nodes,
    edges,
    feeSatoshis: String(root.fee),
    source: "https://blockstream.info/tx/" + identifier,
    coverage: COVERAGE,
    evidence,
  };
}
export function bitcoinEdges(d) {
  const root = d.evidence.transaction,
    spenders = new Map(d.evidence.spendingTransactions.map((t) => [t.txid, t]));
  return d.edges.map((e, index) => {
    const id = e.kind === "spends" ? e.to.slice(7) : root.txid;
    const tx = spenders.get(id) || root;
    return {
      ...e,
      id: root.txid + ":record:" + index,
      amount: e.satoshis,
      unit: "satoshis",
      timestamp: tx.status.confirmed ? tx.status.block_time : null,
      source: "https://blockstream.info/tx/" + id,
    };
  });
}
