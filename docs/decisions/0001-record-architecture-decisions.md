# 1. Record architecture decisions

Date: 2026-05-11

## Status

Accepted

## Context

We need a lightweight way to capture significant technical decisions so future contributors (and recruiters reading the repo) understand the "why" behind the code.

## Decision

We will use Architecture Decision Records (ADRs) as described by Michael Nygard. Each ADR lives in `docs/decisions/` and is numbered sequentially.

## Consequences

- New significant decisions get an ADR before or shortly after implementation.
- ADRs are immutable once accepted; supersede with a new ADR rather than editing.
