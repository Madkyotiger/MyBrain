import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  DISTRIBUTION_DIR,
  canonicalJson,
  copyTree,
  readJson,
  requireAbsolute,
  safeId,
  sha256Text,
  writeJson,
  writeText,
} from './common.ts';
import { runGbrain } from './gbrain-runtime.ts';
import { configureHermesAdapter, type HermesAdapterReceipt } from './hermes-adapter.ts';
import { configureWorkBuddyAdapter, type WorkBuddyAdapterReceipt } from './workbuddy-adapter.ts';
import {
  configureDeepSeekHarnessAdapter,
  type DeepSeekHarnessAdapterReceipt,
} from './deepseek-harness-adapter.ts';

export type LocalAgentRuntime = 'hermes' | 'workbuddy' | 'deepseek-harness' | 'claude-code' | 'codex';

export interface OnboardingAnswers {
  schema_version: 'mybrain-cn-onboarding-v1';
  user: {
    preferred_name: string;
    role: string;
    domains: string[];
    working_languages: string[];
  };
  brain: {
    name: string;
    primary_jobs: string[];
    default_runtime: LocalAgentRuntime;
    source_id?: string;
  };
  boundaries: {
    allowed_data_classes: Array<'public' | 'personal_private' | 'work_authorized'>;
    blocked_data_classes: Array<'org_restricted' | 'client_or_secret'>;
    external_model_for_personal_private: boolean;
  };
  setup?: {
    initial_data_class: 'public' | 'personal_private';
    initial_source_path?: string;
    first_workflow: 'meeting-prep' | 'project-judgment' | 'weekly-judgment-evolution';
    workspace: string;
    state_root: string;
    hermes_config?: string;
    workbuddy_config?: string;
    deepseek_harness_patch?: string;
    backup_output?: string;
  };
}

export interface InitOptions {
  answersPath: string;
  workspace: string;
  stateRoot: string;
  confirmationHash: string;
  hermesConfig?: string;
  workbuddyConfig?: string;
  deepseekHarnessPatch?: string;
  gbrainCli?: string;
  force?: boolean;
}

export function validateAnswers(value: unknown): OnboardingAnswers {
  const a = value as Partial<OnboardingAnswers>;
  if (a?.schema_version !== 'mybrain-cn-onboarding-v1') throw new Error('Unsupported onboarding schema_version.');
  if (!a.user?.preferred_name?.trim() || !a.user.role?.trim()) throw new Error('user.preferred_name and user.role are required.');
  if (!Array.isArray(a.user.domains) || a.user.domains.length === 0) throw new Error('user.domains must not be empty.');
  if (!Array.isArray(a.user.working_languages) || a.user.working_languages.length === 0) throw new Error('user.working_languages must not be empty.');
  if (!a.brain?.name?.trim() || !Array.isArray(a.brain.primary_jobs) || a.brain.primary_jobs.length === 0) {
    throw new Error('brain.name and at least one brain.primary_jobs entry are required.');
  }
  if (!['hermes', 'workbuddy', 'deepseek-harness', 'claude-code', 'codex'].includes(a.brain.default_runtime ?? '')) {
    throw new Error('Unsupported default runtime.');
  }
  safeId(a.brain.source_id ?? 'default', 'brain.source_id');
  const allowed = new Set(a.boundaries?.allowed_data_classes ?? []);
  if (!allowed.has('personal_private')) throw new Error('P1 requires personal_private in allowed_data_classes.');
  const blocked = new Set(a.boundaries?.blocked_data_classes ?? []);
  if (!blocked.has('org_restricted') || !blocked.has('client_or_secret')) {
    throw new Error('org_restricted and client_or_secret must remain blocked in P1.');
  }
  if (a.boundaries?.external_model_for_personal_private !== false) {
    throw new Error('P1 requires external_model_for_personal_private=false by default.');
  }
  if (a.setup) {
    if (!['public', 'personal_private'].includes(a.setup.initial_data_class)) {
      throw new Error('setup.initial_data_class must be public or personal_private.');
    }
    if (!['meeting-prep', 'project-judgment', 'weekly-judgment-evolution'].includes(a.setup.first_workflow)) {
      throw new Error('Unsupported setup.first_workflow.');
    }
    requireAbsolute(a.setup.workspace, 'setup.workspace');
    requireAbsolute(a.setup.state_root, 'setup.state_root');
    if (a.setup.initial_source_path) requireAbsolute(a.setup.initial_source_path, 'setup.initial_source_path');
    if (a.setup.backup_output) requireAbsolute(a.setup.backup_output, 'setup.backup_output');
    if (a.brain.default_runtime === 'hermes') {
      if (!a.setup.hermes_config) throw new Error('setup.hermes_config is required for the Hermes runtime.');
      requireAbsolute(a.setup.hermes_config, 'setup.hermes_config');
    }
    if (a.brain.default_runtime === 'workbuddy') {
      if (!a.setup.workbuddy_config) throw new Error('setup.workbuddy_config is required for the WorkBuddy runtime.');
      requireAbsolute(a.setup.workbuddy_config, 'setup.workbuddy_config');
    }
    if (a.brain.default_runtime === 'deepseek-harness') {
      if (!a.setup.deepseek_harness_patch) {
        throw new Error('setup.deepseek_harness_patch is required for the DeepSeek Harness runtime.');
      }
      requireAbsolute(a.setup.deepseek_harness_patch, 'setup.deepseek_harness_patch');
    }
  }
  return a as OnboardingAnswers;
}

export function loadAnswers(path: string): OnboardingAnswers {
  return validateAnswers(readJson(path));
}

export function onboardingHash(answers: OnboardingAnswers): string {
  return sha256Text(canonicalJson(answers));
}

export function onboardingPlan(answers: OnboardingAnswers, workspace: string, stateRoot: string) {
  return {
    schema_version: 'mybrain-cn-plan-v1',
    confirmation_hash: onboardingHash(answers),
    workspace: requireAbsolute(workspace, 'workspace'),
    state_root: requireAbsolute(stateRoot, 'state root'),
    runtime: answers.brain.default_runtime,
    source_id: safeId(answers.brain.source_id ?? 'default', 'brain.source_id'),
    actions: [
      'render-private-workspace',
      'install-8-skill-entrypoints',
      'install-mybrain-cn-executive-schema',
      'initialize-local-pglite-without-embeddings',
      ...(answers.brain.default_runtime === 'hermes' ? ['write-explicit-hermes-mcp-adapter'] : []),
      ...(answers.brain.default_runtime === 'workbuddy' ? ['write-explicit-workbuddy-mcp-adapter'] : []),
      ...(answers.brain.default_runtime === 'deepseek-harness' ? ['write-explicit-deepseek-harness-mcp-patch'] : []),
    ],
    blocked_by_default: ['org_restricted', 'client_or_secret', 'automatic-bulk-import'],
  };
}

function renderWorkspace(answers: OnboardingAnswers, workspace: string, sourceId: string): void {
  mkdirSync(workspace, { recursive: true });
  const skillSource = join(DISTRIBUTION_DIR, 'skill-pack');
  copyTree(skillSource, join(workspace, 'skills'));
  mkdirSync(join(workspace, 'imports'), { recursive: true });
  mkdirSync(join(workspace, '.mybrain-provenance'), { recursive: true });

  writeText(join(workspace, 'MYBRAIN.md'), `# ${answers.brain.name}\n\n## 使用者\n\n- 称呼：${answers.user.preferred_name}\n- 角色：${answers.user.role}\n- 工作领域：${answers.user.domains.join('、')}\n- 工作语言：${answers.user.working_languages.join('、')}\n\n## 先解决的工作\n\n${answers.brain.primary_jobs.map((job) => `- ${job}`).join('\n')}\n\n## 默认工作方式\n\n先检索，再判断；来源、冲突和未知必须可见。不要为了显得聪明而补完缺失事实。\n`);
  writeText(join(workspace, 'WORKING_BOUNDARIES.md'), `# 工作边界\n\n## 可进入\n\n${answers.boundaries.allowed_data_classes.map((item) => `- ${item}`).join('\n')}\n\n## 默认阻断\n\n${answers.boundaries.blocked_data_classes.map((item) => `- ${item}`).join('\n')}\n\n个人私密内容默认不发给外部模型。任何批量导入都必须由用户明确选定来源。\n`);
  writeText(join(workspace, 'FIRST_LOOP.md'), '# 第一个回路\n\n先从一次真实会前准备开始：导入用户明确选择的材料，检索最近上下文与承诺，输出已知、未知、风险和下一步。不要先导入全部人生。\n');
  writeText(join(workspace, '.gitignore'), '.DS_Store\n*.tmp\n*.bak\n');
  writeJson(join(workspace, 'mybrain.json'), {
    schema_version: 'mybrain-cn-workspace-v1',
    brain_name: answers.brain.name,
    default_runtime: answers.brain.default_runtime,
    source_id: sourceId,
    allowed_data_classes: answers.boundaries.allowed_data_classes,
    blocked_data_classes: answers.boundaries.blocked_data_classes,
  });
}

function ensurePrivateGitRepo(workspace: string, ownerName: string): void {
  const commands = [
    ['init'],
    ['config', 'user.name', ownerName],
    ['config', 'user.email', 'mybrain@localhost'],
    ['add', '.'],
    ['commit', '-m', 'Initialize private MyBrain workspace'],
  ];
  for (const args of commands) {
    const result = spawnSync('git', args, { cwd: workspace, encoding: 'utf8' });
    if ((result.status ?? 1) !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
}

export function initializeMyBrain(options: InitOptions) {
  const answersPath = requireAbsolute(options.answersPath, 'answers path');
  const workspace = requireAbsolute(options.workspace, 'workspace');
  const stateRoot = requireAbsolute(options.stateRoot, 'state root');
  const answers = loadAnswers(answersPath);
  const expectedHash = onboardingHash(answers);
  if (options.confirmationHash !== expectedHash) {
    throw new Error(`Confirmation hash mismatch. Run plan again; expected ${expectedHash}.`);
  }
  if ((existsSync(workspace) || existsSync(join(stateRoot, '.gbrain'))) && !options.force) {
    throw new Error('Workspace or GBrain state already exists; pass --force only after reviewing the target paths.');
  }
  if (options.force) {
    rmSync(workspace, { recursive: true, force: true });
    rmSync(join(stateRoot, '.gbrain'), { recursive: true, force: true });
  }

  const sourceId = safeId(answers.brain.source_id ?? 'default', 'brain.source_id');
  renderWorkspace(answers, workspace, sourceId);
  ensurePrivateGitRepo(workspace, answers.user.preferred_name);

  const packSource = join(DISTRIBUTION_DIR, 'schema-packs', 'mybrain-cn-executive');
  const packTarget = join(stateRoot, '.gbrain', 'schema-packs', 'mybrain-cn-executive');
  copyTree(packSource, packTarget);
  mkdirSync(stateRoot, { recursive: true });
  const dbPath = join(stateRoot, '.gbrain', 'brain.pglite');
  const init = runGbrain(
    ['init', '--pglite', '--path', dbPath, '--no-embedding', '--skip-embed-check', '--schema-pack', 'mybrain-cn-executive', '--json'],
    { stateRoot, cwd: workspace, gbrainCli: options.gbrainCli },
  );

  let hermes: HermesAdapterReceipt | null = null;
  let workbuddy: WorkBuddyAdapterReceipt | null = null;
  let deepseekHarness: DeepSeekHarnessAdapterReceipt | null = null;
  if (answers.brain.default_runtime === 'hermes') {
    if (!options.hermesConfig) throw new Error('Hermes is the selected runtime; pass an explicit --hermes-config path.');
    hermes = configureHermesAdapter({
      configPath: options.hermesConfig,
      stateRoot,
      sourceId,
      gbrainCli: options.gbrainCli,
      force: options.force,
    });
  }
  if (answers.brain.default_runtime === 'workbuddy') {
    if (!options.workbuddyConfig) throw new Error('WorkBuddy is the selected runtime; pass an explicit --workbuddy-config path.');
    workbuddy = configureWorkBuddyAdapter({
      configPath: options.workbuddyConfig,
      stateRoot,
      sourceId,
      gbrainCli: options.gbrainCli,
      force: options.force,
    });
  }
  if (answers.brain.default_runtime === 'deepseek-harness') {
    if (!options.deepseekHarnessPatch) {
      throw new Error('DeepSeek Harness is the selected runtime; pass an explicit --deepseek-harness-patch path.');
    }
    deepseekHarness = configureDeepSeekHarnessAdapter({
      patchPath: options.deepseekHarnessPatch,
      stateRoot,
      workspace,
      sourceId,
      gbrainCli: options.gbrainCli,
      force: options.force,
    });
  }

  const receipt = {
    schema_version: 'mybrain-cn-init-receipt-v1',
    confirmation_hash: expectedHash,
    workspace,
    state_root: stateRoot,
    source_id: sourceId,
    schema_pack: 'mybrain-cn-executive',
    skills_installed: 8,
    gbrain_init_exit: init.code,
    hermes,
    workbuddy,
    deepseek_harness: deepseekHarness,
    runtime_adapter: hermes ?? workbuddy ?? deepseekHarness,
  };
  writeJson(join(workspace, '.mybrain-init-receipt.json'), receipt);
  return receipt;
}
