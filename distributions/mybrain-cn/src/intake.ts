import { basename, extname, join, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  assertInside,
  assertRegularFile,
  readJson,
  requireAbsolute,
  safeId,
  sha256File,
  writeJson,
  writeText,
} from './common.ts';
import { runGbrain } from './gbrain-runtime.ts';

export type DataClass = 'public' | 'personal_private' | 'work_authorized' | 'org_restricted' | 'client_or_secret';

export interface IntakeOptions {
  inputPath: string;
  workspace: string;
  dataClass: DataClass;
  sourceId: string;
  stateRoot?: string;
  sync?: boolean;
  gbrainCli?: string;
}

const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.json']);
const MAX_BYTES = 10 * 1024 * 1024;

function renderImport(inputPath: string, dataClass: DataClass, sourceId: string, hash: string): string {
  const ext = extname(inputPath).toLowerCase();
  const raw = readFileSync(inputPath, 'utf8');
  const body = ext === '.json' ? `\n\`\`\`json\n${raw}\n\`\`\`\n` : `\n${raw}\n`;
  return `---\ntitle: ${JSON.stringify(basename(inputPath))}\ntype: brief\nsource_class: ${dataClass}\nsource_id: ${sourceId}\nsource_hash: ${hash}\n---\n${body}`;
}

function commitImport(workspace: string, relativePath: string): string {
  for (const args of [
    ['add', relativePath, '.mybrain-provenance'],
    ['commit', '-m', `Import ${relativePath}`],
  ]) {
    const result = spawnSync('git', args, { cwd: workspace, encoding: 'utf8' });
    if ((result.status ?? 1) !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' });
  if ((rev.status ?? 1) !== 0) throw new Error(`git rev-parse failed: ${rev.stderr}`);
  return rev.stdout.trim();
}

export function intakeFile(options: IntakeOptions) {
  const inputPath = requireAbsolute(options.inputPath, 'input path');
  const workspace = requireAbsolute(options.workspace, 'workspace');
  const sourceId = safeId(options.sourceId, 'source id');
  assertRegularFile(inputPath);
  if (!existsSync(join(workspace, '.git'))) throw new Error(`Workspace is not an initialized private git repo: ${workspace}`);
  const ext = extname(inputPath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) throw new Error(`Unsupported intake extension ${ext}; allowed: .md, .txt, .json`);
  const size = statSync(inputPath).size;
  if (size > MAX_BYTES) throw new Error(`Input exceeds ${MAX_BYTES} byte P1 limit: ${size}`);

  if (options.dataClass === 'org_restricted' || options.dataClass === 'client_or_secret') {
    throw new Error(`Data class ${options.dataClass} is blocked by MyBrain CN P1 policy.`);
  }
  const workspaceConfig = readJson<{ source_id: string; allowed_data_classes: string[] }>(join(workspace, 'mybrain.json'));
  if (!workspaceConfig.allowed_data_classes.includes(options.dataClass)) {
    throw new Error(`Data class ${options.dataClass} is not allowed by this workspace.`);
  }
  if (options.dataClass === 'work_authorized') {
    throw new Error(
      'work_authorized intake requires a separately registered GBrain source and an explicit source-specific workflow; ' +
      'the P1 automatic intake command refuses to stage it in the personal workspace.',
    );
  }

  const hash = sha256File(inputPath);
  const targetDir = join(workspace, 'imports', sourceId);
  mkdirSync(targetDir, { recursive: true });
  const target = resolve(targetDir, `${hash.slice(0, 12)}-${basename(inputPath, ext)}.md`);
  assertInside(workspace, target);
  if (existsSync(target)) throw new Error(`This content is already staged: ${target}`);
  writeText(target, renderImport(inputPath, options.dataClass, sourceId, hash));
  const relativePath = target.slice(workspace.length + 1).replaceAll('\\', '/');
  const provenancePath = join(workspace, '.mybrain-provenance', `${hash}.json`);
  writeJson(provenancePath, {
    schema_version: 'mybrain-cn-provenance-v1',
    source_ref: inputPath,
    source_hash: hash,
    data_class: options.dataClass,
    source_id: sourceId,
    imported_at: new Date().toISOString(),
    staged_path: relativePath,
  });
  const commit = commitImport(workspace, relativePath);

  let syncReceipt: { code: number; stdout: string; stderr: string } | null = null;
  if (options.sync) {
    if (!options.stateRoot) throw new Error('--sync requires an explicit GBrain state root.');
    if (sourceId !== workspaceConfig.source_id) {
      throw new Error('P1 sync only auto-runs for the workspace default source; register separated work sources explicitly first.');
    }
    syncReceipt = runGbrain(
      ['sync', '--repo', workspace, '--full', '--no-embed', '--no-extract', '--no-pull', '--yes', '--exclude', '.mybrain-provenance/**'],
      { stateRoot: options.stateRoot, cwd: workspace, gbrainCli: options.gbrainCli },
    );
  }

  return {
    schema_version: 'mybrain-cn-intake-receipt-v1',
    status: 'imported',
    source_hash: hash,
    data_class: options.dataClass,
    source_id: sourceId,
    staged_path: relativePath,
    git_commit: commit,
    synced: Boolean(syncReceipt),
  };
}
