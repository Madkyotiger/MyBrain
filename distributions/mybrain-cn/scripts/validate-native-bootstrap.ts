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

  const rootAgents = readFileSync(join(REPO_ROOT, 'AGENTS.md'), 'utf8');
  if (!rootAgents.includes('DEPLOY_FOR_AGENTS.md') || !rootAgents.includes("not a user's personal workspace")) {
    throw new Error('root AGENTS.md must route product deployment away from the source checkout');
  }
  const deployRunbook = readFileSync(join(ROOT, 'DEPLOY_FOR_AGENTS.md'), 'utf8');
  for (const marker of [
    'MyBrain 产品源码',
    'MyBrain-Workspace',
    'gbrain bootstrap status --json',
    'gbrain bootstrap attach',
    'hermes mcp test mybrain',
    'codebuddy mcp get mybrain',
    'dsh --profile web --dump-config',
    '豆包桌面版当前没有已验证',
  ]) {
    if (!deployRunbook.includes(marker)) throw new Error(`deployment runbook marker missing: ${marker}`);
  }

  const hostMatrix = readFileSync(join(ROOT, 'AGENT_HOSTS.md'), 'utf8');
  for (const marker of [
    '驱动原生 Bootstrap',
    '支持候选，目标机验收',
    '引导部署',
    '配置文件生成不能代替 live round-trip',
  ]) {
    if (!hostMatrix.includes(marker)) throw new Error(`host support marker missing: ${marker}`);
  }

  const hostSupport = JSON.parse(readFileSync(join(ROOT, 'host-support.json'), 'utf8')) as any;
  if (hostSupport.schema_version !== 'mybrain-cn-host-support-v1' || hostSupport.bootstrap_owner !== 'gbrain-native') {
    throw new Error('host support contract must keep GBrain native bootstrap as the owner');
  }
  const expectedDeployment: Record<string, string> = {
    codex: 'automatic',
    hermes: 'conditional-agent-driven',
    workbuddy: 'automatic-agent-driven',
    'deepseek-harness': 'guided',
    'feishu-aily': 'manual',
    'doubao-desktop': 'unsupported',
  };
  for (const [host, deployment] of Object.entries(expectedDeployment)) {
    const entry = hostSupport.support?.[host];
    if (entry?.deployment !== deployment) throw new Error(`host support contract mismatch: ${host}`);
    if (deployment !== 'unsupported' && !entry?.target_live_check) {
      throw new Error(`host support contract lacks target live check: ${host}`);
    }
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

  const nativeWorkspace = readFileSync(join(ROOT, 'src/native-workspace.ts'), 'utf8');
  if (!nativeWorkspace.includes('requireNativeBootstrapVerified') || !nativeWorkspace.includes('listVerifyRuns')) {
    throw new Error('post-bootstrap host adapters must be guarded by native verify evidence');
  }
  for (const rel of ['src/hermes-adapter.ts', 'src/workbuddy-adapter.ts', 'src/deepseek-harness-adapter.ts']) {
    const adapter = readFileSync(join(ROOT, rel), 'utf8');
    if (!adapter.includes('requireNativeBootstrapVerified')) throw new Error(`${rel} bypasses native verify gate`);
  }

  const runbook = readFileSync(join(ROOT, 'BOOTSTRAP_FOR_AGENTS.md'), 'utf8');
  for (const marker of [
    '唯一主链路',
    'state/interview.json',
    'gbrain bootstrap interview --confirm',
    'gbrain bootstrap render',
    'mybrain-cn activate',
    'gbrain bootstrap verify',
    'mybrain-cn verify',
    'Asia/Shanghai',
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
