import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateP1 } from './validate-p1.ts';

const ROOT = resolve(import.meta.dir, '..');
const REPO_ROOT = resolve(ROOT, '../..');

export function validateNativeBootstrap() {
  const p1 = validateP1();
  const forbiddenPaths = [
    'src/onboarding.ts',
    'src/interactive-onboarding.ts',
    'fixtures/example-answers.json',
    'hermes-profile',
  ];
  for (const rel of forbiddenPaths) {
    if (existsSync(join(ROOT, rel))) throw new Error(`parallel bootstrap artifact still exists: ${rel}`);
  }

  const cli = readFileSync(join(ROOT, 'src/cli.ts'), 'utf8');
  for (const marker of ["case 'onboard'", "case 'plan'", "case 'init'"]) {
    if (cli.includes(marker)) throw new Error(`parallel CLI entry still exists: ${marker}`);
  }
  for (const marker of ["case 'activate'", "case 'verify'", 'GBrain native bootstrap owns']) {
    if (!cli.includes(marker)) throw new Error(`production CLI marker missing: ${marker}`);
  }

  const activation = readFileSync(join(ROOT, 'src/activation.ts'), 'utf8');
  for (const marker of [
    "from '../../../src/core/bootstrap/interview.ts'",
    "from '../../../src/core/bootstrap/format.ts'",
    "['schema', 'use', MYBRAIN_SCHEMA_PACK]",
    "['skillpack', 'scaffold'",
    "join(workspace, 'state', 'mybrain-cn.json')",
  ]) {
    if (!activation.includes(marker)) throw new Error(`native activation marker missing: ${marker}`);
  }

  const intake = readFileSync(join(ROOT, 'src/intake.ts'), 'utf8');
  if (!intake.includes('readManifest(workspace)') || !intake.includes('manifestState.manifest.source_id')) {
    throw new Error('intake must follow the native workspace manifest source');
  }
  if (intake.includes("join(workspace, 'mybrain.json')")) throw new Error('legacy workspace config is still active');

  const runbook = readFileSync(join(ROOT, 'BOOTSTRAP_FOR_AGENTS.md'), 'utf8');
  for (const marker of [
    '唯一主链路',
    'state/interview.json',
    'gbrain bootstrap interview --confirm',
    'gbrain bootstrap render',
    'mybrain-cn activate',
    'gbrain bootstrap verify',
    'mybrain-cn verify',
  ]) {
    if (!runbook.includes(marker)) throw new Error(`native bootstrap runbook marker missing: ${marker}`);
  }

  const rootPackage = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as any;
  if (rootPackage.bin?.gbrain !== 'src/cli.ts' || rootPackage.bin?.['mybrain-cn'] !== 'distributions/mybrain-cn/src/cli.ts') {
    throw new Error('installed package must expose both the native and thin distribution commands');
  }

  return {
    status: 'pass',
    p1_status: p1.status,
    bootstrap_owner: 'gbrain-native',
    parallel_entries: 0,
    activation: 'post-native-render',
    native_state: ['state/interview.json', 'agent.json'],
  };
}

if (import.meta.main) console.log(JSON.stringify(validateNativeBootstrap(), null, 2));
