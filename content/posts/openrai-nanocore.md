---
title: OpenRai nano-core + RaiFlow Runtime
date: 3309-06-02
created_at: 2026-06-18
modified_at: 2026-06-18
type: DISCOVERY
excerpt: Released typed Nano protocol primitives and paired them with payment detection and settlement runtime work.
tags:
  - openrai
  - nano
  - library
  - typescript
---
Released typed TS protocol primitives (NanoAddress/Amount, RPC pool with failover + auth redaction, WS, adaptive local PoW via nano-rspow, precision math). Paired with RaiFlow payment detection/settlement/events layer. Enables reliable M2M Nano runtimes without rebuilding the block-lattice client every time. Real mainnet integration tests passing. (OpenRai org + CasualSecurityInc nano-rspow.)

## Notes

This should expand into the technical narrative behind the library split: what belongs in protocol primitives, what belongs in runtime orchestration, and where application authors plug in.
