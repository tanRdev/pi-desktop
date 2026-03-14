# ADR 0001: Electron-first shell

## Status

Accepted

## Decision

PiDesk uses Electron as the fixed desktop shell technology.

## Rationale

- The product decision is locked.
- Electron offers the utility-process model we need for a hidden Pi host.
- The project can still stay fast by constraining process count, startup work, and renderer bundle size.
