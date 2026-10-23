// Self-contained SVG: no external assets, scripts, links, or analyst annotations.
function xml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
}
export function evidenceCard(d) {
  const btc = d.network === "bitcoin-mainnet";
  const headline = btc
    ? "Follow the outpoints."
    : d.bridge
      ? "One deposit. Two networks."
      : "Follow the evidence.";
  const detail = btc
    ? `${d.evidence.transaction.vin.length} input${d.evidence.transaction.vin.length === 1 ? "" : "s"} / ${d.evidence.transaction.vout.length} output${d.evidence.transaction.vout.length === 1 ? "" : "s"} / ${d.feeSatoshis} satoshi fee`
    : `${d.nodes.length} nodes / ${d.edges.length} supplied records`;
  const reference = btc
    ? d.evidence.transaction.txid
    : d.bridge
      ? d.bridge.sourceTransaction
      : d.digest.slice(7);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${xml(headline)}">
<rect width="1200" height="630" fill="#edf3f0"/><rect x="0" y="0" width="18" height="630" fill="#2d604d"/>
<g font-family="Arial, sans-serif" fill="#173e39"><text x="65" y="75" font-size="26" font-weight="700">Positano Investigations</text>
<text x="65" y="126" font-size="21">${d.synthetic ? "Synthetic example" : "Provider-reported evidence / consistency checked"}</text>
<text x="65" y="226" font-size="60" font-weight="700">${xml(headline)}</text><text x="65" y="284" font-size="28">${xml(detail)}</text>
<path d="M90 355 H550 M585 355 H1050" stroke="#b67416" stroke-width="5"/><circle cx="90" cy="355" r="13" fill="#2d604d"/><circle cx="565" cy="355" r="23" fill="#b67416"/><circle cx="1050" cy="355" r="13" fill="#2d604d"/>
<text x="65" y="421" font-size="18" font-family="monospace">${xml(reference)}</text>
<text x="65" y="467" font-size="19">Share the case JSON and report to reproduce. No ownership or finality claim.</text>
<text x="65" y="510" font-size="16" font-family="monospace">${xml(d.digest)}</text>
<text x="65" y="578" font-size="22">Open source: github.com/Positano777/blockchain-investigation-kit</text></g></svg>`;
}

export async function evidenceCardPng(d) {
  const image = new Image();
  const ready = new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("Evidence card rendering failed."));
  });
  image.src =
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(evidenceCard(d));
  await ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  canvas.getContext("2d").drawImage(image, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Evidence card export failed.")),
      "image/png",
    ),
  );
}
