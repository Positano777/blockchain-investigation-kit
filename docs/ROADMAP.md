# Delivery roadmap and community release criteria

The product promise is **a reproducible trail from a transaction to its evidence, with visible gaps**. This roadmap is a plan, not a claim that all networks/features exist. There is no guaranteed virality or adoption.

| Milestone | Status | Completion criteria |
| --- | --- | --- |
| Portable EVM/bridge investigation | Bounded prototype; 11 EVM mainnets in v0.9 | Local reconstruction, inspectable evidence, honest coverage |
| Local persistent workspace | Shipped | SQLite cases, separate notes, reopen after restart, protected local writes |
| Bitcoin interactive trail | Shipped in v0.7 | Browser import/graph, checked outpoints, saved cases, manual next capture |
| Reproducible sharing | Shipped in v0.7 | PNG card, JSON/report, checksum/reference, no analyst notes in exports |
| Bitcoin snapshot comparison | Shipped in v0.7 | Changed spend/status observations, disagreement flags, both source digests |
| Solana transaction decoder | Bounded v0.8 preview shipped | Mainnet capture; exact lamport/token units; explicit program/instruction references; failed/CPI behavior tested; unsupported instructions labeled |
| pump.fun lifecycle evidence | Next, not implemented | Version-pinned creation/curve/migration/disposal decoding; actual mainnet fixtures; no timing-only bundle claims |
| Indexed history and watchlists | Planned | Cursor/range/cap provenance, reorganization handling, deduplication, provider budgets, persistent jobs and cancellation |
| Non-EVM expansion beyond Bitcoin/Solana | Not implemented | Dedicated reviewed adapters; official metadata, real fixtures, negative and browser tests; see [network matrix](NETWORKS.md) |
| Wider bridge routes | Planned | Protocol-specific message derivation and captured destination evidence for each supported route |
| Case exchange/API | Planned | Versioned connector API, reproducible fixtures, migration policy, explicit annotation export, cross-tool examples |
| Community beta | Needs external use | Five independent testers complete the walkthrough; all blocking reproducible bugs fixed; unsupported cases displayed clearly |

## How to earn distribution

Release around one question a user can answer today: **Where did this transaction's outputs go, and what evidence supports the trail?** Show a short screen recording using public evidence, then offer the same JSON/report so readers can reproduce it. Add a changed-snapshot example only when it is explicitly labeled constructed or is backed by real captures.

Measure completed walkthroughs, reproducible bug reports, external tools importing the schema, and accepted contributions. Stars/impressions alone do not establish investigation quality. Do not fabricate testimonials, adoption numbers, accuracy claims, or a security audit.

Proposed first beta gate: five independent testers, three public reproducible case contributions, and one external integration consuming an exported case. These are targets, not achieved metrics.

Publish code changes with source attribution, limits, passing checks, and an example before promoting the capability. Keep the current hosted preview owner-private until the owner explicitly changes the audience; it is not a community-accessible live service today. GitHub source and downloadable examples are the public handoff.

## Contributing

Pick a bounded connector, decoder, or usability gap. Include a public or synthetic fixture, expected exact units, negative cases, source/license attribution, and a statement of what the evidence does not establish. Never install a wallet seed, signing agent, or unknown trading executable to analyze public transactions. Run `python -m unittest discover -s tests` and `node --test tests/*.test.mjs`.
