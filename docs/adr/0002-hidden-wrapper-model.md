# ADR 0002: Hidden wrapper model

## Status

Accepted

## Decision

PiDesk is the only user-facing interface. The Pi CLI/TUI is never shown.

## Rationale

- The app is explicitly a wrapper product.
- UI ownership stays inside PiDesk.
- This keeps future renderer contracts stable even if Pi integration details change.
