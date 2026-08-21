import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DISTRIBUTION_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = resolve(DISTRIBUTION_DIR, '..', '..');
export const GBRAIN_CLI = join(REPO_ROOT, 'src', 'cli.ts');

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function writeJson(path: string, value: unknown): void {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, content, { mode: 0o600 });
  renameSync(tmp, path);
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256Text(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sha256File(path: string): string {
  return sha256Text(readFileSync(path));
}

export function requireAbsolute(path: string, label: string): string {
  if (!isAbsolute(path)) throw new Error(`${label} must be an absolute path: ${path}`);
  return resolve(path);
}

export function assertRegularFile(path: string): void {
  const stat = statSync(path);
  if (!stat.isFile()) throw new Error(`Expected a regular file: ${path}`);
}

export function assertInside(parent: string, child: string): void {
  const p = resolve(parent);
  const c = resolve(child);
  const rel = relative(p, c);
  if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))) return;
  throw new Error(`Path escapes allowed root: ${child}`);
}

export function copyTree(source: string, target: string): void {
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true, force: false, errorOnExist: true });
}

export function parseFlags(args: string[]): { values: Map<string, string>; booleans: Set<string>; positionals: string[] } {
  const values = new Map<string, string>();
  const booleans = new Set<string>();
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    if (arg.includes('=')) {
      const [key, ...rest] = arg.split('=');
      values.set(key, rest.join('='));
      continue;
    }
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      values.set(arg, next);
      i += 1;
    } else {
      booleans.add(arg);
    }
  }
  return { values, booleans, positionals };
}

export function requiredFlag(values: Map<string, string>, name: string): string {
  const value = values.get(name)?.trim();
  if (!value) throw new Error(`Missing required flag ${name}`);
  return value;
}

export function safeId(value: string, label = 'id'): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(normalized)) {
    throw new Error(`${label} must match [a-z0-9-] and be 1-32 chars: ${value}`);
  }
  return normalized;
}
