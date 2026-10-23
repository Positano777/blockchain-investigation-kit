const buttons = [...document.querySelectorAll("[data-view]")];
const graph = document.getElementById("graph");
const viewport = document.createElement("div");
viewport.className = "graph-viewport";
viewport.tabIndex = 0;
viewport.setAttribute(
  "aria-label",
  "Evidence graph. Scroll horizontally on a narrow screen.",
);
graph.before(viewport);
viewport.append(graph);
export function openView(name) {
  for (const button of buttons) {
    const active = button.dataset.view === name;
    button.setAttribute("aria-pressed", String(active));
    document.getElementById("view-" + button.dataset.view).hidden = !active;
  }
}
for (const button of buttons)
  button.addEventListener("click", () => openView(button.dataset.view));
// Comparison belongs with export, not with provider configuration.
const comparison = document.getElementById("compare-import").closest("details");
document.getElementById("view-share").append(comparison);
const library = document.getElementById("view-library");
const primaryExamples = library.querySelector(".toolbar");
primaryExamples.classList.add("example-cards");
const more = document.createElement("details");
const moreTitle = document.createElement("summary");
moreTitle.textContent = "More examples and synthetic test cases";
const extraExamples = document.createElement("div");
extraExamples.className = "toolbar";
more.append(moreTitle, extraExamples);
primaryExamples.after(more);
for (const button of [...primaryExamples.children]) {
  const descriptions = {
    bitcoin: [
      "Follow a Bitcoin spend",
      "Trace outputs into their reported spending transactions.",
    ],
    solana: [
      "Understand a Solana transaction",
      "Inspect transfers, fees and observed balance changes.",
    ],
    bridge: [
      "Follow a bridge deposit",
      "Check an Ethereum deposit against its derived Optimism transaction.",
    ],
  };
  if (!descriptions[button.id]) {
    extraExamples.append(button);
    continue;
  }
  const [title, detail] = descriptions[button.id];
  button.textContent = title;
  const description = document.createElement("span");
  description.textContent = detail;
  button.append(description);
}
// Keep provider setup after the local workflow, where it is needed.
const command = document.getElementById("expand").closest("details");
document.getElementById("view-capture").append(command);
const local = !!document.querySelector(
  'meta[name="investigation-service"][content="local"]',
);
if (local)
  document.getElementById("workspace-mode").textContent =
    "Local investigation workspace";
else {
  const bitcoinInput = document.getElementById("bitcoin-txid");
  bitcoinInput.closest("label").hidden = true;
  bitcoinInput.closest("label").nextElementSibling.hidden = true;
  document.getElementById("local-status").classList.add("static-help");
  document.getElementById("local-status").textContent =
    "This preview explores saved evidence. To capture a new transaction and save investigations on your computer, download the source and run python serve.py, then open http://127.0.0.1:8080. No wallet connection is needed.";
}
document.addEventListener("investigation-case-ready", () =>
  openView("explore"),
);
