import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { loadPackFromFile } from '../../../src/core/schema-pack/index.ts';

const ROOT = resolve(import.meta.dir, '..');
const REPO_ROOT = resolve(ROOT, '../..');
const decoder = new TextDecoder();

type JsonObject = Record<string, any>;

export interface P0Receipt {
  status: 'pass';
  upstream_base: string;
  required_files: number;
  data_classes: number;
  eval_cases: number;
  schema_pack: string;
  p0_gates: string[];
  phase1_blockers: string[];
}

function readJson(rel: string): JsonObject {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as JsonObject;
}

function git(args: string[], allowFailure = false): { code: number; stdout: string; stderr: string } {
  const p = Bun.spawnSync(['git', ...args], {
    cwd: REPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const result = {
    code: p.exitCode,
    stdout: decoder.decode(p.stdout).trimEnd(),
    stderr: decoder.decode(p.stderr).trim(),
  };
  if (!allowFailure && result.code !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}

function allFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...allFiles(full));
    else out.push(full);
  }
  return out;
}

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicate IDs`);
}

function changedPaths(): string[] {
  const status = git(['status', '--porcelain=v1', '--untracked-files=all']).stdout;
  if (!status) return [];
  return status.split('\n').map((line) => {
    const raw = line.slice(3).trim();
    const path = raw.includes(' -> ') ? raw.split(' -> ').at(-1)! : raw;
    return path.replace(/^"|"$/g, '');
  });
}

export function validateP0(): P0Receipt {
  const manifest = readJson('manifest.json');
  if (!['mybrain-cn-p0-v1', 'mybrain-cn-p1-v1'].includes(manifest.schema_version)) {
    throw new Error('unexpected manifest schema_version');
  }
  if (!['p0-candidate', 'p1-candidate'].includes(manifest.status)) {
    throw new Error('distribution status must retain a validated P0/P1 candidate state');
  }
  if (manifest.architecture?.core_policy !== 'overlay-first') throw new Error('core policy must stay overlay-first');

  const required = manifest.required_files as string[];
  unique(required, 'required_files');
  for (const rel of required) {
    if (!existsSync(join(ROOT, rel))) throw new Error(`required file missing: ${rel}`);
  }

  const allowed = manifest.fork.allowed_delta_prefixes as string[];
  for (const changed of changedPaths()) {
    if (!allowed.some((prefix) => changed.startsWith(prefix))) {
      throw new Error(`working-tree change escapes overlay: ${changed}`);
    }
  }

  const base = String(manifest.upstream.base_commit);
  const ancestor = git(['merge-base', '--is-ancestor', base, 'HEAD'], true);
  if (ancestor.code !== 0) throw new Error(`upstream base is not an ancestor of HEAD: ${base}`);
  const committedDelta = git(['diff', '--name-only', `${base}...HEAD`]).stdout;
  for (const changed of committedDelta ? committedDelta.split('\n') : []) {
    if (!allowed.some((prefix) => changed.startsWith(prefix))) {
      throw new Error(`committed delta escapes overlay: ${changed}`);
    }
  }

  const data = readJson('data-policy.json');
  const classes = data.classes as JsonObject[];
  unique(classes.map((c) => c.id), 'data classes');
  for (const id of ['public', 'personal_private', 'work_authorized', 'org_restricted', 'client_or_secret']) {
    if (!classes.some((c) => c.id === id)) throw new Error(`data class missing: ${id}`);
  }
  for (const id of ['org_restricted', 'client_or_secret']) {
    const klass = classes.find((c) => c.id === id)!;
    if (klass.default !== 'blocked' || klass.external_model !== 'blocked') {
      throw new Error(`${id} must be blocked locally and for external models`);
    }
  }

  const acceptance = readJson('mvp-acceptance.json');
  const p0 = acceptance.p0 as JsonObject[];
  unique(p0.map((item) => item.id), 'P0 acceptance');
  if (p0.length !== 6 || p0.some((item) => item.status !== 'pass')) {
    throw new Error('all six P0 gates must be pass');
  }
  const phase1 = acceptance.phase1_entry as JsonObject[];
  const owner = phase1.find((item) => item.id === 'P1-OWNER');
  if (!owner || !['blocked', 'pass'].includes(owner.status)) {
    throw new Error('Phase 1 owner gate must be explicitly blocked or passed');
  }

  const packPath = join(ROOT, 'schema-packs/mybrain-cn-executive/pack.yaml');
  const pack = loadPackFromFile(packPath);
  if (pack.name !== 'mybrain-cn-executive' || pack.extends !== 'gbrain-base-v2') {
    throw new Error('unexpected Executive schema identity or base');
  }
  const pageTypes = new Set(pack.page_types.map((item) => item.name));
  for (const type of ['meeting', 'decision', 'commitment', 'brief', 'signal']) {
    if (!pageTypes.has(type)) throw new Error(`Executive schema type missing: ${type}`);
  }

  const evaluation = readJson('evals/retrieval-baseline.json');
  const cases = evaluation.cases as JsonObject[];
  unique(cases.map((item) => item.id), 'retrieval cases');
  for (const id of [
    'cjk-short-name',
    'english-alias-to-cjk',
    'cjk-organization',
    'mixed-language',
    'cjk-body-phrase',
    'source-isolation-default',
    'source-isolation-explicit',
    'negative-control',
  ]) {
    if (!cases.some((item) => item.id === id)) throw new Error(`retrieval case missing: ${id}`);
  }

  const banned = [
    'J' + 'Brain',
    '@' + 'comm',
    '/mnt/' + 'c/Users/',
    'SZgyf6Gd' + 'VlAo7QdneY7cing0n9f',
    'rq4l4q' + 'pza5a',
  ];
  for (const file of allFiles(ROOT)) {
    if (!/\.(md|json|ya?ml|ts)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const marker of banned) {
      if (text.includes(marker)) throw new Error(`private marker ${marker} found in ${relative(ROOT, file)}`);
    }
  }

  return {
    status: 'pass',
    upstream_base: base,
    required_files: required.length,
    data_classes: classes.length,
    eval_cases: cases.length,
    schema_pack: `${pack.name}@${pack.version}`,
    p0_gates: p0.map((item) => item.id),
    phase1_blockers: phase1.filter((item) => item.status === 'blocked').map((item) => item.id),
  };
}

if (import.meta.main) {
  console.log(JSON.stringify(validateP0(), null, 2));
}
