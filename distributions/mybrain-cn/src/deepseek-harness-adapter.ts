import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import yaml from 'js-yaml';
import { GBRAIN_CLI, requireAbsolute } from './common.ts';

export interface DeepSeekHarnessAdapterOptions {
  patchPath: string;
  stateRoot: string;
  workspace: string;
  sourceId?: string;
  gbrainCli?: string;
  force?: boolean;
}

export interface DeepSeekHarnessAdapterReceipt {
  schema_version: 'mybrain-cn-deepseek-harness-adapter-v1';
  patch_path: string;
  patch_id: 'mybrain-mcp';
  server_name: 'mybrain';
  transport: 'stdio';
  changed: boolean;
  backup_path: string | null;
  support_level: 'developer-preview';
  live_client_check: 'not-run';
}

type PatchOperation = { insert?: Array<Record<string, any>> } & Record<string, any>;

function parseOperations(text: string, path: string): PatchOperation[] {
  if (!text.trim()) return [];
  const parsed = yaml.load(text);
  if (!Array.isArray(parsed)) throw new Error(`DeepSeek Harness patch must be a YAML operation array: ${path}`);
  return parsed as PatchOperation[];
}

export function configureDeepSeekHarnessAdapter(options: DeepSeekHarnessAdapterOptions): DeepSeekHarnessAdapterReceipt {
  const patchPath = requireAbsolute(options.patchPath, 'DeepSeek Harness patch path');
  const stateRoot = requireAbsolute(options.stateRoot, 'GBrain state root');
  const workspace = requireAbsolute(options.workspace, 'MyBrain workspace');
  const gbrainCli = requireAbsolute(options.gbrainCli ?? GBRAIN_CLI, 'GBrain CLI path');
  const original = existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : '';
  const operations = parseOperations(original, patchPath);
  const existing = operations.some((operation) =>
    (operation.insert ?? []).some((entry) => entry.id === 'mybrain-mcp'),
  );
  if (existing && !options.force) {
    throw new Error(`DeepSeek Harness patch 'mybrain-mcp' already exists in ${patchPath}; pass --force to replace only that entry.`);
  }

  const cleaned = operations.map((operation) => ({
    ...operation,
    ...(operation.insert
      ? { insert: operation.insert.filter((entry) => entry.id !== 'mybrain-mcp') }
      : {}),
  })).filter((operation) => !operation.insert || operation.insert.length > 0);
  cleaned.push({
    insert: [{
      id: 'mybrain-mcp',
      name: '@deepseek-ai/dsh-mcp-client',
      config: {
        serverName: 'mybrain',
        transport: 'stdio',
        command: 'bun',
        args: ['run', gbrainCli, 'serve', '--surface', 'verbs', '--source-guard'],
        cwd: workspace,
        env: {
          GBRAIN_HOME: stateRoot,
          GBRAIN_SOURCE: options.sourceId ?? 'default',
          GBRAIN_SWEEP: '0',
        },
        toolCallTimeoutMs: 120000,
        failOnStartupError: true,
      },
    }],
  });

  const rendered = yaml.dump(cleaned, { noRefs: true, lineWidth: 120, sortKeys: false });
  const changed = rendered !== original;
  let backupPath: string | null = null;
  if (changed) {
    mkdirSync(dirname(patchPath), { recursive: true });
    if (original) {
      backupPath = `${patchPath}.mybrain-cn.bak`;
      writeFileSync(backupPath, original, { mode: 0o600 });
    }
    const tmp = `${patchPath}.tmp-${process.pid}`;
    writeFileSync(tmp, rendered, { mode: 0o600 });
    renameSync(tmp, patchPath);
  }

  return {
    schema_version: 'mybrain-cn-deepseek-harness-adapter-v1',
    patch_path: resolve(patchPath),
    patch_id: 'mybrain-mcp',
    server_name: 'mybrain',
    transport: 'stdio',
    changed,
    backup_path: backupPath,
    support_level: 'developer-preview',
    live_client_check: 'not-run',
  };
}
