import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';
import { validateP1 } from './validate-p1.ts';

const ROOT = resolve(import.meta.dir, '..');
const PROFILE = join(ROOT, 'hermes-profile');

type JsonObject = Record<string, any>;

function readJson(path: string): JsonObject {
  return JSON.parse(readFileSync(path, 'utf8')) as JsonObject;
}

function directories(path: string): string[] {
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function validateP11() {
  const p1 = validateP1();
  const manifest = readJson(join(ROOT, 'manifest.json'));
  if (manifest.schema_version !== 'mybrain-cn-p1.1-v1' || manifest.status !== 'p1.1-candidate') {
    throw new Error('P1.1 manifest must be mybrain-cn-p1.1-v1 / p1.1-candidate');
  }
  for (const rel of manifest.p1_1?.required_files ?? []) {
    if (!existsSync(join(ROOT, rel))) throw new Error(`P1.1 required file missing: ${rel}`);
  }

  const interactive = readFileSync(join(ROOT, 'src/interactive-onboarding.ts'), 'utf8');
  for (const marker of ['第 1 轮', '第 2 轮', '第 3 轮', '最终完整回读', "installAnswer !== 'INSTALL'", 'requires a TTY']) {
    if (!interactive.includes(marker)) throw new Error(`Interactive onboarding gate missing: ${marker}`);
  }
  if (interactive.indexOf('writeJson(round3.answers_path') > interactive.indexOf("installAnswer !== 'INSTALL'")) {
    throw new Error('Validated answers must be saved before the separate install confirmation.');
  }

  const profileManifest = yaml.load(readFileSync(join(PROFILE, 'distribution.yaml'), 'utf8')) as JsonObject;
  if (profileManifest.name !== 'mybrain-cn' || !String(profileManifest.hermes_requires).startsWith('>=')) {
    throw new Error('Hermes profile manifest identity/version requirement is invalid.');
  }
  const owned = new Set(profileManifest.distribution_owned as string[]);
  for (const rel of ['distribution.yaml', 'SOUL.md', 'config.yaml', 'mcp.json', 'skills/']) {
    if (!owned.has(rel)) throw new Error(`Hermes distribution_owned missing ${rel}`);
  }
  const requiredEnv = new Set(
    (profileManifest.env_requires as JsonObject[]).filter((item) => item.required).map((item) => item.name),
  );
  for (const name of ['MYBRAIN_GBRAIN_CLI', 'MYBRAIN_GBRAIN_HOME', 'MYBRAIN_SOURCE_ID']) {
    if (!requiredEnv.has(name)) throw new Error(`Hermes profile required env missing: ${name}`);
  }

  const config = yaml.load(readFileSync(join(PROFILE, 'config.yaml'), 'utf8')) as JsonObject;
  const server = config.mcp_servers?.mybrain;
  if (server?.command !== 'bun' || JSON.stringify(server.args) !== JSON.stringify([
    'run', '${MYBRAIN_GBRAIN_CLI}', 'serve', '--surface', 'verbs', '--source-guard',
  ])) throw new Error('Hermes profile MCP command is not the bounded placeholder-based server.');
  if (server.env?.GBRAIN_HOME !== '${MYBRAIN_GBRAIN_HOME}' || server.env?.GBRAIN_SWEEP !== '0') {
    throw new Error('Hermes profile MCP environment is unsafe or machine-specific.');
  }
  const mcp = readJson(join(PROFILE, 'mcp.json'));
  if (!mcp.mcpServers || Object.keys(mcp.mcpServers).length !== 0) throw new Error('mcp.json must be valid and carry no duplicate server or credential.');

  const expectedSkills = [...manifest.product.mvp_skills].sort() as string[];
  const profileSkills = directories(join(PROFILE, 'skills'));
  if (JSON.stringify(profileSkills) !== JSON.stringify(expectedSkills)) throw new Error('Hermes profile must contain exactly the existing eight skills.');
  for (const name of expectedSkills) {
    const canonical = readFileSync(join(ROOT, 'skill-pack', name, 'SKILL.md'), 'utf8');
    const packaged = readFileSync(join(PROFILE, 'skills', name, 'SKILL.md'), 'utf8');
    if (packaged !== canonical) throw new Error(`Hermes profile skill drift: ${name}`);
  }

  for (const forbidden of ['auth.json', '.env', 'memories', 'sessions', 'state.db', 'workspace']) {
    if (existsSync(join(PROFILE, forbidden))) throw new Error(`User-owned path shipped in public profile: ${forbidden}`);
  }
  const publicText = [
    'distribution.yaml', 'SOUL.md', 'config.yaml', 'mcp.json', 'README.md',
    ...profileSkills.map((name) => `skills/${name}/SKILL.md`),
  ].map((rel) => readFileSync(join(PROFILE, rel), 'utf8')).join('\n');
  if (/(?:\/home\/[^/\s]+|\/Users\/[^/\s]+|[A-Za-z]:\\Users\\[^\\\s]+)/.test(publicText)) {
    throw new Error('Machine-specific absolute path found in public Hermes profile.');
  }
  if (/(?:sk-|gbrain_)[A-Za-z0-9_-]{12,}/.test(publicText)) throw new Error('Credential-like value found in public Hermes profile.');

  const acceptance = readJson(join(ROOT, 'acceptance/p1.1-evidence-template.json'));
  if (acceptance.overall_status !== 'not-run' || acceptance.scenarios?.length !== 4) {
    throw new Error('Human acceptance pack must contain four unclaimed scenarios.');
  }
  for (const id of ['HA-01', 'HA-02', 'HA-03', 'HA-04']) {
    const scenario = acceptance.scenarios.find((item: JsonObject) => item.id === id);
    if (!scenario || scenario.status !== 'not-run' || !scenario.pass_rule || !scenario.evidence) {
      throw new Error(`Human acceptance evidence/rule missing or falsely claimed: ${id}`);
    }
  }

  return {
    status: 'pass',
    p0_p1_static_regression: p1.status,
    onboarding_rounds: 3,
    install_confirmation: 'separate-exact-token',
    hermes_profile: profileManifest.name,
    hermes_skills: profileSkills,
    human_acceptance_status: acceptance.overall_status,
  };
}

if (import.meta.main) console.log(JSON.stringify(validateP11(), null, 2));
