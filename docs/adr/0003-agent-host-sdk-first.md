# ADR 0003: Agent host uses the Pi SDK first

## Status

Accepted

## Decision

Run Pi inside a hidden Electron utility process through the SDK first, while keeping renderer-facing events RPC-shaped.

## Rationale

- Avoids surfacing the Pi CLI.
- Reuses Electron's bundled Node runtime.
- Leaves room for an RPC fallback later without rewriting UI contracts.
