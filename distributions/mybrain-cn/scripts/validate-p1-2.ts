import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateNativeBootstrap } from './validate-native-bootstrap.ts';

const ROOT = resolve(import.meta.dir, '..');
const REPO_ROOT = resolve(ROOT, '../..');
type JsonObject = Record<string, any>;

function readJson(path: string): JsonObject {
  return JSON.parse(readFileSync(path, 'utf8')) as JsonObject;
}

export function validateHosts() {
  const native = validateNativeBootstrap();
  const manifest = readJson(join(ROOT, 'manifest.json'));
  const agentDriven = manifest.native_bootstrap?.agent_driven_hosts as string[];
  const conditionalAgentDriven = manifest.native_bootstrap?.conditional_agent_driven_hosts as string[];
  const nativeWire = manifest.native_bootstrap?.native_wire_hosts as string[];
  const adapterHosts = manifest.native_bootstrap?.adapter_hosts as string[];
  const guidedHosts = manifest.native_bootstrap?.guided_hosts as string[];
  const manualHosts = manifest.native_bootstrap?.manual_hosts as string[];
  const unsupported = manifest.native_bootstrap?.unsupported_hosts as string[];
  if (JSON.stringify(agentDriven) !== JSON.stringify(['claude-code', 'codex', 'opencode', 'workbuddy'])) {
    throw new Error('agent-driven bootstrap host list drifted');
  }
  if (JSON.stringify(conditionalAgentDriven) !== JSON.stringify(['hermes'])) {
    throw new Error('conditional agent-driven bootstrap host list drifted');
  }
  if (JSON.stringify(nativeWire) !== JSON.stringify(['claude-code', 'codex', 'opencode'])) {
    throw new Error('GBrain native wire host list drifted');
  }
  if (JSON.stringify(adapterHosts) !== JSON.stringify(['hermes', 'workbuddy', 'deepseek-harness'])) {
    throw new Error('post-bootstrap adapter host list drifted');
  }
  if (JSON.stringify(guidedHosts) !== JSON.stringify(['deepseek-harness'])) {
    throw new Error('guided host list drifted');
  }
  if (JSON.stringify(manualHosts) !== JSON.stringify(['feishu-aily'])) {
    throw new Error('manual host list drifted');
  }
  if (!unsupported.includes('doubao-desktop')) throw new Error('Doubao Desktop must stay unsupported until an official interface is verified');
  if (manifest.release?.live_non_native_clients !== 'not-run') {
    throw new Error('live non-native clients must not be claimed before account round-trips');
  }

  const rootReadme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');
  if (!rootReadme.startsWith('# @MyBrain\n')) throw new Error('root README must be the @MyBrain public front door');
  for (const stale of ["I'm Garry Tan", 'President and CEO of Y Combinator', 'contact me at', '豆包工作伙伴']) {
    if (rootReadme.includes(stale)) throw new Error(`stale public identity or host claim remains: ${stale}`);
  }
  if (!rootReadme.includes('GBrain') || !rootReadme.includes('MIT License')) {
    throw new Error('root README must preserve upstream attribution and license visibility');
  }

  const workbuddy = readFileSync(join(ROOT, 'src/workbuddy-adapter.ts'), 'utf8');
  const deepseek = readFileSync(join(ROOT, 'src/deepseek-harness-adapter.ts'), 'utf8');
  const feishu = readFileSync(join(ROOT, 'src/feishu-aily-handoff.ts'), 'utf8');
  for (const [name, text] of [['WorkBuddy', workbuddy], ['DeepSeek Harness', deepseek]] as const) {
    for (const marker of ["'serve', '--surface', 'verbs', '--source-guard'", "GBRAIN_SWEEP: '0'"]) {
      if (!text.includes(marker)) throw new Error(`${name} adapter is missing bounded MCP marker: ${marker}`);
    }
  }
  for (const marker of ["endpoint.protocol !== 'https:'", 'Credentials must not be embedded', 'deployment_included: false', 'credentials_included: false']) {
    if (!feishu.includes(marker)) throw new Error(`Feishu Aily safety marker missing: ${marker}`);
  }
  if (existsSync(join(ROOT, 'src/doubao-work-handoff.ts'))) throw new Error('mislabelled Doubao Work handoff still exists');

  const acceptance = readJson(join(ROOT, 'mvp-acceptance.json')).release_build as JsonObject[];
  const hostProof = acceptance.find((item) => item.id === 'RC-08');
  if (!hostProof || hostProof.status !== 'pass') throw new Error('post-bootstrap host adapter proof is missing');

  return {
    status: 'pass',
    native_bootstrap_status: native.status,
    agent_driven_hosts: agentDriven,
    conditional_agent_driven_hosts: conditionalAgentDriven,
    native_wire_hosts: nativeWire,
    adapter_hosts: adapterHosts,
    guided_hosts: guidedHosts,
    manual_hosts: manualHosts,
    unsupported_hosts: unsupported,
    live_non_native_clients: manifest.release.live_non_native_clients,
  };
}

if (import.meta.main) console.log(JSON.stringify(validateHosts(), null, 2));
