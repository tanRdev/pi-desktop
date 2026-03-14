# ADR 0005: Performance budgets are mandatory

## Status

Accepted

## Decision

PiDesk enforces startup, memory, streaming, and bundle budgets from the first milestones onward.

## Initial budgets

- visible shell in a warm start under 1500ms
- visible shell in a cold start under 2500ms
- idle RSS with no repo under 250MB
- initial renderer bundle excludes Monaco, xterm, diff editor, syntax highlighter, and repo search helpers
