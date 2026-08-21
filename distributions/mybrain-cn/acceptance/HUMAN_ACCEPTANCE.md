# @MyBrain P1.1 Human Acceptance Pack

This pack is a protocol and blank evidence template, not a claim that human acceptance has happened. Do not put names, meeting content, credentials, or other user data in the public repository. Store completed evidence in the private project control plane and reference only redacted receipt IDs here if needed.

## Global rules

- One accountable human operator records start/end time, environment class, command/version identifiers, redacted receipt paths, observed result, and exceptions.
- `PASS` requires every scenario-specific rule. `FAIL` applies when any required rule fails or evidence is missing. `NOT_RUN` is the initial and honest status.
- Synthetic fixtures may prove mechanics but cannot prove Day 1 usefulness or Day 7 behavior change.
- Stop on ambiguous data ownership, restricted/client-secret content, unexpected target paths, hash drift, unsupported claims, or recovery checksum failure.

## HA-01 — Day 1 meeting prep

Use one real but authorized, narrowly selected meeting-prep source. Record the source class without recording its contents, the intake receipt ID, query time, result receipt, operator usefulness judgment, unsupported-claim count, visible unknowns, and action chosen.

Pass only if intake was explicit, classification was allowed, the output restored at least one useful sourced fact or commitment, exposed at least one unknown/boundary, produced no unsupported consequential claim, and changed or confirmed a concrete meeting action. Otherwise fail.

## HA-02 — Cross-session correction retrieval

Correct one non-sensitive factual detail, close the session/process, open a fresh process, and retrieve it. Record write receipt, process/session boundary evidence, read receipt, old/new truth handling, provenance visibility, and latency.

Pass only if the correction is returned in the fresh process, the stale claim is not presented as current truth, and provenance is visible. A successful write without fresh-process readback fails.

## HA-03 — Backup and recovery

Stop writes, create and verify a backup, restore into isolated targets, reconnect credentials separately, run doctor, and retrieve one known page plus the correction. Record lock state, manifest/checksum receipt, isolated paths (redacted), restore receipt, doctor result, retrieval receipts, and whether credentials were absent from exported config.

Pass only if backup refused any live lock, every checksum passed, restore used isolated targets, doctor passed, both page and correction were retrievable, and credentials were not restored from exported config. Otherwise fail.

## HA-04 — Day 7 action/judgment change

On or after seven calendar days from Day 1, compare the initial intended action/judgment with current behavior using the weekly-evolution loop. Record dates, the original receipt reference, new evidence references, correction/reversal evidence, operator explanation, and one observed action or judgment change (or an explicit evidence-backed decision not to change).

Pass only if seven days elapsed, the comparison uses retrievable evidence from both periods, and the operator can identify a concrete action/judgment difference or an evidence-backed decision to hold course. Content volume, number of captured notes, or synthetic replay alone does not pass.

The committed template status for HA-04 must remain `not-run`; this repository does not claim a real Day 7 result.
