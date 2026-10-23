# Workspace usability revision — 2026-10-23

The evidence viewer previously placed its graph below example buttons, downloads,
provider setup, comparison, and expansion controls. The static preview displayed a
Bitcoin input without an available capture action. Bundled mainnet examples were
labeled as imported evidence, and opening an imported/saved case retained the old
example URL. Graph edges were mouse-only and selected records were not visibly
coordinated with the timeline.

The workspace now separates Explore evidence, Examples & import, Capture & saved
cases, and Export & compare. The library starts with three explained real-data
workflows, with additional/synthetic examples behind a disclosure. The graph and
inspector sit together. Coverage, checksum and technical summaries remain available
through disclosures. Mobile graphs can scroll horizontally to preserve label size.

Behavior changes:

- Successful imports, saved-case opens and example selections return to Explore.
- Imports and saved-case opens clear misleading example fragments from the URL.
- Selected records highlight their timeline row and graph connection; selection
  survives filtering while that record remains visible.
- Graph connections support Enter/Space and visible keyboard focus.
- Invalid date ranges explain recovery; empty searches retain the active case.
- Example loading/errors have visible status; stale example/import failures cannot
  overwrite a newer selection's status.
- Comparison download stays disabled until a successful comparison.
- The static preview hides the unusable Bitcoin input and explains local setup.

## Verification

- Existing Python suite: 79 tests passed.
- Existing Node suite: 59 tests passed.
- Chrome: all 24 bundled cases (13 original workflows plus 11 EVM examples).
- Record/edge highlighting, keyboard edge selection, empty filters, date error
  recovery, invalid JSON followed by valid import, correct provenance and URL state.
- Case JSON, text report, PNG evidence card and Bitcoin comparison JSON downloads.
- Local service: save/reopen, preserved analyst notes, invalid Bitcoin/EVM/Solana
  transaction input feedback; no live capture required for this UI regression.
- All four views at 390px: no document horizontal overflow. Desktop inspected at
  1440px. No page errors in the exercised journeys; static viewer made no API calls.
- `git diff --check` passed. No dependency additions.

These are bounded regression checks, not a claim of zero bugs or a complete
accessibility audit. Hosted capture, general cross-chain tracing and complete
transaction history remain outside this revision. The existing network coverage
and evidence limitations still apply.
