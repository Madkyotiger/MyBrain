import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateP0 } from './validate-p0.ts';

const ROOT = resolve(import.meta.dir, '..');

type JsonObject = Record<string, any>;

function readJson(rel: string): JsonObject {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as JsonObject;
}

export function validateP1() {
  const p0 = validateP0();
  const manifest = readJson('manifest.json');
  if (manifest.schema_version !== 'mybrain-cn-p1-v1' || manifest.status !== 'p1-candidate') {
    throw new Error('P1 manifest must be mybrain-cn-p1-v1 / p1-candidate');
  }
  if (manifest.p1?.default_runtime !== 'hermes' || manifest.p1?.mcp_surface !== 'verbs') {
    throw new Error('P1 must stay Hermes-first and expose the bounded verbs surface');
  }
  for (const rel of manifest.p1.required_files as string[]) {
    if (!existsSync(join(ROOT, rel))) throw new Error(`P1 required file missing: ${rel}`);
  }

  const expectedSkills = manifest.product.mvp_skills as string[];
  const actualSkills = readdirSync(join(ROOT, 'skill-pack'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (actualSkills.length !== 8 || JSON.stringify(actualSkills) !== JSON.stringify([...expectedSkills].sort())) {
    throw new Error(`P1 skill pack mismatch: ${actualSkills.join(', ')}`);
  }
  for (const name of actualSkills) {
    const text = readFileSync(join(ROOT, 'skill-pack', name, 'SKILL.md'), 'utf8');
    if (!text.includes(`name: ${name}`) || text.length < 300) throw new Error(`Skill is missing or too thin: ${name}`);
  }

  const acceptance = readJson('mvp-acceptance.json');
  const build = acceptance.p1_build as JsonObject[];
  if (build.length !== 6 || build.some((item) => item.status !== 'pass')) {
    throw new Error('All six P1 build proofs must be pass');
  }
  const owner = (acceptance.phase1_entry as JsonObject[]).find((item) => item.id === 'P1-OWNER');
  if (!owner || owner.status !== 'pass') throw new Error('P1 accountable owner must be named in the private control plane');
  const support = (acceptance.phase1_entry as JsonObject[]).find((item) => item.id === 'P1-SUPPORT');
  if (!support || support.status !== 'deferred') throw new Error('Support owner must remain an explicit P2 gate');

  const adapter = readFileSync(join(ROOT, 'src/hermes-adapter.ts'), 'utf8');
  if (!adapter.includes("'--surface', 'verbs'") || !adapter.includes("'--source-guard'")) {
    throw new Error('Hermes adapter must remain verbs-only and source-guarded');
  }

  return {
    status: 'pass',
    p0_status: p0.status,
    p1_build_proofs: build.map((item) => item.id),
    skills: actualSkills,
    default_runtime: manifest.p1.default_runtime,
    mcp_surface: manifest.p1.mcp_surface,
    remaining_human_gates: (acceptance.mvp as JsonObject[])
      .filter((item) => String(item.status).startsWith('pending'))
      .map((item) => item.id),
  };
}

if (import.meta.main) console.log(JSON.stringify(validateP1(), null, 2));
