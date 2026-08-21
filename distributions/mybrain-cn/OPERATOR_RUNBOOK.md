# @MyBrain P1.1 Operator Runbook

This runbook is for a single-user local PGLite deployment. It is not a clean-machine certification, an enterprise permission model, or a substitute for organizational policy.

## 1. Install

1. Install Bun, GBrain, and Hermes using their own official instructions.
2. From this distribution directory run `bun src/cli.ts onboard` in an interactive terminal.
3. Complete all three rounds. Each round requires its own `确认`, followed by a final full readback and another `确认`.
4. The command writes the private answers file and prints the existing plan plus `confirmation_hash`.
5. Initialization runs only if the operator then enters the separate exact token `INSTALL`. Any other input stops after planning.
6. For the public Hermes profile, set `MYBRAIN_GBRAIN_CLI` and `MYBRAIN_GBRAIN_HOME` privately, then run:

   ```bash
   hermes profile install /path/to/distributions/mybrain-cn/hermes-profile --name mybrain-cn -y
   ```

The interactive command refuses non-TTY input. Existing `plan` and `init` commands remain available for reviewed automation using an explicit answers file and confirmation hash.

## 2. Classify before intake

Use `public` or `personal_private` for the first narrow workflow. `work_authorized` requires an independently registered source and explicit organizational authorization; the automatic personal intake path refuses it. `org_restricted` and `client_or_secret` are always blocked. Never place credentials in source material, the answers file, Git, tests, or the public Hermes package.

## 3. First test

Choose one synthetic or explicitly authorized note, then run `intake --sync` and `meeting-prep`. Pass only if the response contains relevant sourced context, names a visible unknown, and does not introduce unsupported facts. Run `doctor` after initialization. Do not start with a bulk import.

## 4. Fail-stop procedure

Stop immediately if classification is unclear, a target path differs from the final readback, the confirmation hash changes, the MCP starts without source guard, a restricted file is staged, retrieval invents context, or backup detects a live lock. Preserve logs and receipts without copying private note contents into public issues. Diagnose before retrying; do not use `--force` until the exact isolated target is reviewed.

## 5. Export and delete

- Export: stop GBrain/Hermes writes, run `backup`, then `backup-verify`. Treat the backup as a sensitive asset because its PGLite database may contain private data and runtime authorization records.
- Delete one source item: remove the staged Markdown and provenance record in the private workspace, commit that deletion, run an explicit full sync, and verify recall no longer returns it. Use GBrain's supported page/forget operations for atomic facts and verify with a fresh read.
- Delete the whole installation: first create and verify an export if retention is desired; stop all processes; resolve and review the exact workspace, state-root, and installed Hermes profile targets; then remove them using the platform's normal profile/delete and filesystem controls. This overlay intentionally provides no broad recursive wipe command.

## 6. Recovery

1. Stop the MCP/GBrain process. A live PGLite lock must fail backup closed.
2. Run `backup-verify --backup <absolute-backup-path>`.
3. Restore to new, isolated absolute workspace and state-root paths without `--force`.
4. Reconnect runtime credentials separately; backups intentionally redact configuration credentials.
5. Run `doctor`, recall one known synthetic/test page, and verify a known correction in a fresh process before switching the runtime to the restored state.

## 7. Known boundaries

P1.1 covers local single-user PGLite, an installable public Hermes profile, explicit-source intake, bounded MEMORY_VERBS MCP, and operator-guided recovery. It does not prove a clean-machine install, real Day 7 value, multi-user operation, remote Postgres, SSO, enterprise audit, Feishu/WeChat connectors, legal compliance, or China data residency. Human acceptance evidence remains `not-run` until a real operator records it without copying private content into this repository.
