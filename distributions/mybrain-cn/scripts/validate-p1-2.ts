import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateP11 } from './validate-p1-1.ts';

const ROOT = resolve(import.meta.dir, '..');
const REPO_ROOT = resolve(ROOT, '../..');

type JsonObject = Record<string, any>;

function readJson(path: string): JsonObject {
  return JSON.parse(readFileSync(path, 'utf8')) as JsonObject;
}

export function validateP12() {
  const p11 = validateP11();
  const manifest = readJson(join(ROOT, 'manifest.json'));
  if (manifest.schema_version !== 'mybrain-cn-p1.2-v1' || manifest.status !== 'p1.2-candidate') {
    throw new Error('P1.2 manifest must be mybrain-cn-p1.2-v1 / p1.2-candidate');
  }
  for (const rel of manifest.p1_2?.required_files ?? []) {
    if (!existsSync(join(ROOT, rel))) throw new Error(`P1.2 required file missing: ${rel}`);
  }

  const rootReadme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');
  if (!rootReadme.startsWith('# @MyBrain\n')) throw new Error('Root README must be the @MyBrain public front door.');
  for (const stale of ["I'm Garry Tan", 'President and CEO of Y Combinator', 'contact me at']) {
    if (rootReadme.includes(stale)) throw new Error(`Upstream personal project identity remains in root README: ${stale}`);
  }
  if (!rootReadme.includes('GBrain') || !rootReadme.includes('MIT License')) {
    throw new Error('Root README must preserve concise upstream attribution and license visibility.');
  }

  const support = manifest.p1_2?.host_support as JsonObject;
  const expected = {
    hermes: 'verified-automated',
    workbuddy: 'adapter-verified-live-client-not-run',
    'deepseek-harness': 'developer-preview-adapter-verified-live-client-not-run',
    'doubao-work': 'handoff-verified-remote-runtime-not-supplied',
  };
  for (const [host, status] of Object.entries(expected)) {
    if (support?.[host]?.status !== status) throw new Error(`P1.2 host status drift: ${host}`);
  }
  if (manifest.p1_2?.live_non_hermes_clients !== 'not-run') {
    throw new Error('Non-Hermes live clients must not be claimed before real account round-trips.');
  }

  const workbuddy = readFileSync(join(ROOT, 'src/workbuddy-adapter.ts'), 'utf8');
  const deepseek = readFileSync(join(ROOT, 'src/deepseek-harness-adapter.ts'), 'utf8');
  const doubao = readFileSync(join(ROOT, 'src/doubao-work-handoff.ts'), 'utf8');
  for (const [name, text] of [['WorkBuddy', workbuddy], ['DeepSeek Harness', deepseek]] as const) {
    for (const marker of ["'serve', '--surface', 'verbs', '--source-guard'", "GBRAIN_SWEEP: '0'"]) {
      if (!text.includes(marker)) throw new Error(`${name} adapter is missing bounded MCP marker: ${marker}`);
    }
  }
  for (const marker of ["endpoint.protocol !== 'https:'", 'Credentials must not be embedded', "deployment_included: false", "credentials_included: false"]) {
    if (!doubao.includes(marker)) throw new Error(`Doubao Work safety marker missing: ${marker}`);
  }

  const acceptance = readJson(join(ROOT, 'mvp-acceptance.json')).p1_2_build as JsonObject[];
  const statuses = Object.fromEntries(acceptance.map((item) => [item.id, item.status]));
  if (statuses['P1.2-01'] !== 'pass' || statuses['P1.2-02'] !== 'pass-automated' ||
      statuses['P1.2-03'] !== 'pass-automated-preview' || statuses['P1.2-04'] !== 'pass-handoff' ||
      statuses['P1.2-05'] !== 'pending-live-clients') {
    throw new Error('P1.2 acceptance must distinguish automated adapter proof from pending live clients.');
  }

  return {
    status: 'pass',
    p1_1_regression: p11.status,
    public_identity: '@MyBrain',
    agent_hosts: support,
    live_non_hermes_clients: manifest.p1_2.live_non_hermes_clients,
  };
}

if (import.meta.main) console.log(JSON.stringify(validateP12(), null, 2));
