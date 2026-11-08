# Improvement roadmap

The first delivery preserves user input and makes workspace removal safe. The remaining work has separate GitHub issues so each change can ship with its own failure-case tests.

| Priority | Task | Issue | Delivery |
| --- | --- | --- | --- |
| P1 | Prompt formatting, per-thread drafts, completion races, attachment retention | [#6](https://github.com/tanRdev/pi-desktop/issues/6) | Implemented in the foundations change |
| P1 | Safe worktree removal, repository detachment, explicit base branches | [#7](https://github.com/tanRdev/pi-desktop/issues/7) | Implemented in the foundations change |
| P1 | File watching, fallback search, Git palette actions | [#8](https://github.com/tanRdev/pi-desktop/issues/8) | Fallback search implemented; watcher and palette remain |
| P1 | Agent acceptance, startup diagnostics, disconnect recovery, bounded transport | [#9](https://github.com/tanRdev/pi-desktop/issues/9) | Next |
| P2 | Follow-up queue and typed image attachments | [#10](https://github.com/tanRdev/pi-desktop/issues/10) | After delivery states are explicit |
| P2 | Stable turn identities, virtualized history, scroll restoration | [#11](https://github.com/tanRdev/pi-desktop/issues/11) | Measure with a large-history fixture |
| P2 | Accurate file changes, diff-line feedback, staged worktree setup | [#12](https://github.com/tanRdev/pi-desktop/issues/12) | Reuse existing Git and task controllers |

## Delivery rules

- Preserve prompt text and attachment context until the submission outcome is known.
- A newer draft or another thread must not change when an earlier turn completes.
- Ordinary removal must refuse dirty files. Repository detachment must preserve checkout files.
- Keep metadata until the corresponding Git operation succeeds.
- Reject an explicit starting branch that does not exist.
- Resolve an uncertain delivery before retrying a command that may already have executed.
- Reuse the isolated agent host, typed Electron contracts, worktree services, and versioned persistence.

The roadmap came from Pi source review and REA inspection of Codex package 26.1007.30912. Codex observations informed the behavior goals. Implementations use Pi's own code and architecture.
