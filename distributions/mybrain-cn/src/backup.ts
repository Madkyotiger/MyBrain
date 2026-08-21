import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { isProcessAlive } from '../../../src/core/pglite-lock.ts';
import { readJson, requireAbsolute, sha256File, writeJson } from './common.ts';

type ManifestEntry = { path: string; sha256: string; bytes: number };

interface BackupManifest {
  schema_version: 'mybrain-cn-backup-v1';
  created_at: string;
  workspace_name: string;
  files: ManifestEntry[];
  config_credentials_included: false;
  database_contains_private_data: true;
  database_may_contain_runtime_secrets: true;
}

const SECRET_KEY = /(api[_-]?key|secret|token|password|database_url)/i;

function redactConfigSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactConfigSecrets);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SECRET_KEY.test(key))
      .map(([key, child]) => [key, redactConfigSecrets(child)]),
  );
}

function copyWithoutLocks(source: string, target: string): void {
  cpSync(source, target, {
    recursive: true,
    filter: (path) => !path.split(/[\\/]/).includes('.gbrain-lock'),
  });
}

function collectFiles(root: string, current = root): ManifestEntry[] {
  const out: ManifestEntry[] = [];
  for (const name of readdirSync(current).sort()) {
    const path = join(current, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...collectFiles(root, path));
    else if (stat.isFile()) out.push({ path: relative(root, path).replaceAll('\\', '/'), sha256: sha256File(path), bytes: stat.size });
  }
  return out;
}

function assertNoLiveLock(databasePath: string): void {
  const lockPath = join(databasePath, '.gbrain-lock', 'lock');
  if (!existsSync(lockPath)) return;
  try {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as { pid?: number; command?: string };
    if (typeof lock.pid !== 'number') throw new Error(`Cannot prove PGLite lock owner: ${lockPath}`);
    if (isProcessAlive(lock.pid)) {
      throw new Error(`PGLite is live under PID ${lock.pid} (${lock.command ?? 'unknown'}). Stop the agent/MCP server before backup.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('PGLite is live')) throw error;
    throw new Error(`Cannot prove PGLite lock is safe: ${lockPath}`);
  }
}

export function createBackup(options: { workspace: string; stateRoot: string; output: string }) {
  const workspace = requireAbsolute(options.workspace, 'workspace');
  const stateRoot = requireAbsolute(options.stateRoot, 'state root');
  const output = requireAbsolute(options.output, 'backup output');
  if (existsSync(output)) throw new Error(`Backup output already exists: ${output}`);
  const configPath = join(stateRoot, '.gbrain', 'config.json');
  const config = readJson<Record<string, unknown>>(configPath);
  const databasePath = String(config.database_path ?? join(stateRoot, '.gbrain', 'brain.pglite'));
  assertNoLiveLock(databasePath);

  mkdirSync(output, { recursive: true });
  copyWithoutLocks(workspace, join(output, 'workspace'));
  copyWithoutLocks(databasePath, join(output, 'gbrain', 'brain.pglite'));
  const safeConfig = redactConfigSecrets(config) as Record<string, unknown>;
  safeConfig.database_path = './brain.pglite';
  writeJson(join(output, 'gbrain', 'config.json'), safeConfig);
  const files = collectFiles(output).filter((entry) => entry.path !== 'manifest.json');
  const manifest: BackupManifest = {
    schema_version: 'mybrain-cn-backup-v1',
    created_at: new Date().toISOString(),
    workspace_name: basename(workspace),
    files,
    config_credentials_included: false,
    database_contains_private_data: true,
    database_may_contain_runtime_secrets: true,
  };
  writeJson(join(output, 'manifest.json'), manifest);
  return { ...manifest, output };
}

export function verifyBackup(outputPath: string): BackupManifest {
  const output = requireAbsolute(outputPath, 'backup path');
  const manifest = readJson<BackupManifest>(join(output, 'manifest.json'));
  if (manifest.schema_version !== 'mybrain-cn-backup-v1') throw new Error('Unsupported backup manifest.');
  for (const entry of manifest.files) {
    const path = resolve(output, entry.path);
    const rel = relative(output, path);
    if (rel.startsWith(`..${sep}`) || rel === '..') throw new Error(`Backup manifest path escapes root: ${entry.path}`);
    if (!existsSync(path)) throw new Error(`Backup file missing: ${entry.path}`);
    if (sha256File(path) !== entry.sha256) throw new Error(`Backup checksum mismatch: ${entry.path}`);
  }
  return manifest;
}

export function restoreBackup(options: { backup: string; targetWorkspace: string; targetStateRoot: string; force?: boolean }) {
  const backup = requireAbsolute(options.backup, 'backup');
  const targetWorkspace = requireAbsolute(options.targetWorkspace, 'target workspace');
  const targetStateRoot = requireAbsolute(options.targetStateRoot, 'target state root');
  const manifest = verifyBackup(backup);
  if ((existsSync(targetWorkspace) || existsSync(join(targetStateRoot, '.gbrain'))) && !options.force) {
    throw new Error('Restore targets already exist; pass --force only for an isolated target you intend to replace.');
  }
  if (options.force) {
    rmSync(targetWorkspace, { recursive: true, force: true });
    rmSync(join(targetStateRoot, '.gbrain'), { recursive: true, force: true });
  }
  mkdirSync(dirname(targetWorkspace), { recursive: true });
  copyWithoutLocks(join(backup, 'workspace'), targetWorkspace);
  const targetGbrain = join(targetStateRoot, '.gbrain');
  mkdirSync(targetGbrain, { recursive: true });
  copyWithoutLocks(join(backup, 'gbrain', 'brain.pglite'), join(targetGbrain, 'brain.pglite'));
  const config = readJson<Record<string, unknown>>(join(backup, 'gbrain', 'config.json'));
  config.database_path = join(targetGbrain, 'brain.pglite');
  writeJson(join(targetGbrain, 'config.json'), config);
  return {
    schema_version: 'mybrain-cn-restore-receipt-v1',
    source_manifest_created_at: manifest.created_at,
    target_workspace: targetWorkspace,
    target_state_root: targetStateRoot,
    credentials_restored: false,
  };
}
