import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import yaml from 'js-yaml';
import { GBRAIN_CLI, requireAbsolute } from './common.ts';
import { resolveNativeSourceId } from './native-workspace.ts';

export interface HermesAdapterOptions {
  configPath: string;
  stateRoot: string;
  workspace: string;
  sourceId?: string;
  gbrainCli?: string;
  force?: boolean;
}

export interface HermesAdapterReceipt {
  schema_version: 'mybrain-cn-hermes-adapter-v1';
  config_path: string;
  server_name: 'mybrain';
  command: 'bun';
  gbrain_cli: string;
  surface: 'verbs';
  source_guard: true;
  changed: boolean;
  backup_path: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function configureHermesAdapter(options: HermesAdapterOptions): HermesAdapterReceipt {
  const configPath = requireAbsolute(options.configPath, 'Hermes config path');
  const stateRoot = requireAbsolute(options.stateRoot, 'GBrain state root');
  const { sourceId } = resolveNativeSourceId(options.workspace, options.sourceId);
  const gbrainCli = requireAbsolute(options.gbrainCli ?? GBRAIN_CLI, 'GBrain CLI path');
  const original = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
  const parsed = original.trim() ? asRecord(yaml.load(original)) : {};
  const servers = asRecord(parsed.mcp_servers);

  if (servers.mybrain && !options.force) {
    throw new Error(`Hermes MCP server 'mybrain' already exists in ${configPath}; pass --force to replace only that entry.`);
  }

  const server = {
    command: 'bun',
    args: ['run', gbrainCli, 'serve', '--surface', 'verbs', '--source-guard'],
    env: {
      GBRAIN_HOME: stateRoot,
      GBRAIN_SOURCE: sourceId,
      GBRAIN_SWEEP: '0',
    },
    enabled: true,
    timeout: 120,
    connect_timeout: 60,
    resources: false,
    prompts: false,
  };
  const next = { ...parsed, mcp_servers: { ...servers, mybrain: server } };
  const rendered = yaml.dump(next, { noRefs: true, lineWidth: 120, sortKeys: false });
  const changed = rendered !== original;
  let backupPath: string | null = null;

  if (changed) {
    mkdirSync(dirname(configPath), { recursive: true });
    if (original) {
      backupPath = `${configPath}.mybrain-cn.bak`;
      writeFileSync(backupPath, original, { mode: 0o600 });
    }
    const tmp = `${configPath}.tmp-${process.pid}`;
    writeFileSync(tmp, rendered, { mode: 0o600 });
    renameSync(tmp, configPath);
  }

  return {
    schema_version: 'mybrain-cn-hermes-adapter-v1',
    config_path: resolve(configPath),
    server_name: 'mybrain',
    command: 'bun',
    gbrain_cli: gbrainCli,
    surface: 'verbs',
    source_guard: true,
    changed,
    backup_path: backupPath,
  };
}
