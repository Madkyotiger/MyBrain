import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { applyEdits, modify, parse as parseJsonc, type ParseError } from 'jsonc-parser';
import { GBRAIN_CLI, requireAbsolute } from './common.ts';

export interface WorkBuddyAdapterOptions {
  configPath: string;
  stateRoot: string;
  sourceId?: string;
  gbrainCli?: string;
  force?: boolean;
}

export interface WorkBuddyAdapterReceipt {
  schema_version: 'mybrain-cn-workbuddy-adapter-v1';
  config_path: string;
  server_name: 'mybrain';
  transport: 'stdio';
  changed: boolean;
  backup_path: string | null;
  live_client_check: 'not-run';
}

export function configureWorkBuddyAdapter(options: WorkBuddyAdapterOptions): WorkBuddyAdapterReceipt {
  const configPath = requireAbsolute(options.configPath, 'WorkBuddy MCP config path');
  const stateRoot = requireAbsolute(options.stateRoot, 'GBrain state root');
  const gbrainCli = requireAbsolute(options.gbrainCli ?? GBRAIN_CLI, 'GBrain CLI path');
  const original = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
  const base = original.trim() ? original : '{}\n';
  const errors: ParseError[] = [];
  const parsed = parseJsonc(base, errors, { allowTrailingComma: true, disallowComments: false }) as Record<string, any> | undefined;
  if (errors.length > 0 || !parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`WorkBuddy config is not valid JSONC: ${configPath}`);
  }
  if (parsed.mcpServers?.mybrain && !options.force) {
    throw new Error(`WorkBuddy MCP server 'mybrain' already exists in ${configPath}; pass --force to replace only that entry.`);
  }

  const server = {
    type: 'stdio',
    command: 'bun',
    args: ['run', gbrainCli, 'serve', '--surface', 'verbs', '--source-guard'],
    env: {
      GBRAIN_HOME: stateRoot,
      GBRAIN_SOURCE: options.sourceId ?? 'default',
      GBRAIN_SWEEP: '0',
    },
    description: '@MyBrain bounded memory verbs',
  };
  const edits = modify(base, ['mcpServers', 'mybrain'], server, {
    formattingOptions: { insertSpaces: true, tabSize: 2 },
  });
  const rendered = applyEdits(base, edits);
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
    schema_version: 'mybrain-cn-workbuddy-adapter-v1',
    config_path: resolve(configPath),
    server_name: 'mybrain',
    transport: 'stdio',
    changed,
    backup_path: backupPath,
    live_client_check: 'not-run',
  };
}
