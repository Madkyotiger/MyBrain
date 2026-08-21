import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface NativeFixtureOptions {
  workspace: string;
  stateRoot: string;
  sourceId?: string;
  agentName?: string;
  activatedAt?: string;
}

export function writeSuccessfulNativeVerifyFixture(options: NativeFixtureOptions): {
  activatedAt: string;
  verifiedAt: string;
} {
  const sourceId = options.sourceId ?? 'workspace';
  const agentName = options.agentName ?? 'test';
  const activatedAt = options.activatedAt ?? '2026-08-21T00:00:00.000Z';
  const verifiedAt = new Date(Date.parse(activatedAt) + 1_000).toISOString();
  mkdirSync(options.workspace, { recursive: true });
  const agentPath = join(options.workspace, 'agent.json');
  if (!existsSync(agentPath)) {
    writeFileSync(agentPath, JSON.stringify({
      format_version: 1,
      initialized: true,
      agent_name: agentName,
      created_by: 'test',
      created_at: '2026-08-21T00:00:00.000Z',
      source_id: sourceId,
    }, null, 2));
  }

  const activationPath = join(options.workspace, 'state', 'mybrain-cn.json');
  mkdirSync(join(options.workspace, 'state'), { recursive: true });
  if (!existsSync(activationPath)) {
    writeFileSync(activationPath, JSON.stringify({ activated_at: activatedAt }, null, 2));
  }
  const activation = JSON.parse(readFileSync(activationPath, 'utf8')) as { activated_at?: string };
  const effectiveActivatedAt = activation.activated_at ?? activatedAt;
  const effectiveVerifiedAt = new Date(Date.parse(effectiveActivatedAt) + 1_000).toISOString();

  const bootstrapDir = join(options.stateRoot, '.gbrain', 'bootstrap');
  mkdirSync(bootstrapDir, { recursive: true });
  writeFileSync(join(bootstrapDir, 'receipt.json'), JSON.stringify({
    receipt_version: 1,
    workspace_dir: options.workspace,
    source_id: sourceId,
    agent_name: agentName,
    created_at: '2026-08-21T00:00:00.000Z',
    created_by: 'test',
    brain_created_by_bootstrap: true,
    created_paths: [],
    registrations: [],
  }, null, 2));
  writeFileSync(
    join(bootstrapDir, `verify-${effectiveVerifiedAt.replace(/[:.]/g, '-')}.json`),
    JSON.stringify({ ts: effectiveVerifiedAt, ok: true, checks: [] }, null, 2),
  );
  return { activatedAt: effectiveActivatedAt, verifiedAt: effectiveVerifiedAt };
}
