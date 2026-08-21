import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { requireAbsolute, safeId, writeJson } from './common.ts';
import {
  initializeMyBrain,
  onboardingPlan,
  validateAnswers,
  type InitOptions,
  type OnboardingAnswers,
} from './onboarding.ts';

export interface OnboardingIO {
  ask(prompt: string): Promise<string>;
  write(message: string): void;
}

export interface InteractiveOnboardingOptions {
  io: OnboardingIO;
  initialize?: (options: InitOptions) => unknown;
  gbrainCli?: string;
  force?: boolean;
}

function required(value: string, label: string): string {
  const answer = value.trim();
  if (!answer) throw new Error(`${label} is required; onboarding stopped without a default.`);
  return answer;
}

function choice<T extends string>(value: string, choices: readonly T[], label: string): T {
  const answer = required(value, label);
  if (!choices.includes(answer as T)) throw new Error(`${label} must be one of: ${choices.join(', ')}`);
  return answer as T;
}

function list(value: string, label: string): string[] {
  const values = required(value, label).split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  if (values.length === 0) throw new Error(`${label} must contain at least one value.`);
  return values;
}

function optionalAbsolute(value: string, label: string): string {
  const answer = value.trim();
  return answer ? requireAbsolute(answer, label) : '';
}

async function confirm(io: OnboardingIO, label: string): Promise<void> {
  const answer = (await io.ask(`${label} 输入“确认”继续：`)).trim();
  if (answer !== '确认') throw new Error(`${label} was not explicitly confirmed; onboarding stopped.`);
}

function renderReadback(title: string, value: unknown): string {
  return `\n=== ${title}回读 ===\n${JSON.stringify(value, null, 2)}\n`;
}

export async function runInteractiveOnboarding(options: InteractiveOnboardingOptions) {
  const { io } = options;
  io.write('@MyBrain P1.1 交互式 onboarding。必答题不会使用默认值；标为可跳过的题可直接回车。\n');

  const round1 = {
    preferred_name: (await io.ask('第 1 轮｜希望如何称呼你？（可跳过）：')).trim(),
    role: required(await io.ask('第 1 轮｜你的职业角色是什么？（必答）：'), '职业角色'),
    domains: list(await io.ask('第 1 轮｜主要工作领域是什么？多个用逗号分隔（必答）：'), '工作领域'),
    working_languages: list(await io.ask('第 1 轮｜工作语言是什么？多个用逗号分隔（必答）：'), '工作语言'),
    brain_name: required(await io.ask('第 1 轮｜这个工作脑叫什么？（必答）：'), '工作脑名称'),
    purpose: required(await io.ask('第 1 轮｜它首先要解决什么工作？（必答）：'), '首要用途'),
    runtime: choice(
      await io.ask('第 1 轮｜运行时选择 hermes / claude-code / codex（必答）：'),
      ['hermes', 'claude-code', 'codex'] as const,
      '运行时',
    ),
  };
  io.write(renderReadback('第 1 轮：用途与运行时', round1));
  await confirm(io, '第 1 轮');

  const round2 = {
    initial_data_class: choice(
      await io.ask('第 2 轮｜首份材料分级选择 public / personal_private（必答）：'),
      ['public', 'personal_private'] as const,
      '首份材料分级',
    ),
    source_id: safeId(
      required(await io.ask('第 2 轮｜个人 source ID（1-32 位小写字母/数字/连字符，必答）：'), 'source ID'),
      'source ID',
    ),
    initial_source_path: optionalAbsolute(
      await io.ask('第 2 轮｜首份材料的绝对路径（可跳过，不会自动导入）：'),
      '首份材料路径',
    ),
  };
  io.write(renderReadback('第 2 轮：数据边界与来源', {
    ...round2,
    blocked: ['org_restricted', 'client_or_secret'],
    work_authorized: '必须使用独立 source；本 onboarding 不自动导入',
    external_model_for_personal_private: false,
  }));
  await confirm(io, '第 2 轮');

  const round3 = {
    first_workflow: choice(
      await io.ask('第 3 轮｜首个回路选择 meeting-prep / project-judgment / weekly-judgment-evolution（必答）：'),
      ['meeting-prep', 'project-judgment', 'weekly-judgment-evolution'] as const,
      '首个回路',
    ),
    workspace: requireAbsolute(required(await io.ask('第 3 轮｜私有 workspace 绝对路径（必答）：'), 'workspace'), 'workspace'),
    state_root: requireAbsolute(required(await io.ask('第 3 轮｜私有 GBrain state root 绝对路径（必答）：'), 'state root'), 'state root'),
    hermes_config: round1.runtime === 'hermes'
      ? requireAbsolute(required(await io.ask('第 3 轮｜Hermes config.yaml 绝对路径（必答）：'), 'Hermes config'), 'Hermes config')
      : undefined,
    backup_output: optionalAbsolute(await io.ask('第 3 轮｜计划使用的备份目录绝对路径（可跳过）：'), '备份目录'),
    answers_path: requireAbsolute(
      required(await io.ask('第 3 轮｜保存 onboarding answers 的绝对路径（必答）：'), 'answers path'),
      'answers path',
    ),
  };
  io.write(renderReadback('第 3 轮：首个工作流与运行细节', round3));
  await confirm(io, '第 3 轮');

  const answers = validateAnswers({
    schema_version: 'mybrain-cn-onboarding-v1',
    user: {
      preferred_name: round1.preferred_name || '(未提供)',
      role: round1.role,
      domains: round1.domains,
      working_languages: round1.working_languages,
    },
    brain: {
      name: round1.brain_name,
      primary_jobs: [round1.purpose],
      default_runtime: round1.runtime,
      source_id: round2.source_id,
    },
    boundaries: {
      allowed_data_classes: ['public', 'personal_private'],
      blocked_data_classes: ['org_restricted', 'client_or_secret'],
      external_model_for_personal_private: false,
    },
    setup: {
      initial_data_class: round2.initial_data_class,
      ...(round2.initial_source_path ? { initial_source_path: round2.initial_source_path } : {}),
      first_workflow: round3.first_workflow,
      workspace: round3.workspace,
      state_root: round3.state_root,
      ...(round3.hermes_config ? { hermes_config: round3.hermes_config } : {}),
      ...(round3.backup_output ? { backup_output: round3.backup_output } : {}),
    },
  } satisfies OnboardingAnswers);

  io.write(renderReadback('最终完整', { answers, answers_path: round3.answers_path, force: options.force === true }));
  await confirm(io, '最终完整回读');
  writeJson(round3.answers_path, answers);
  const plan = onboardingPlan(answers, round3.workspace, round3.state_root);
  io.write(`\nAnswers 已保存。安装计划与 confirmation_hash：\n${JSON.stringify(plan, null, 2)}\n`);

  const installAnswer = (await io.ask('这是独立安装确认。输入大写 INSTALL 才会初始化；其他输入将安全停止：')).trim();
  if (installAnswer !== 'INSTALL') {
    return { schema_version: 'mybrain-cn-interactive-onboarding-v1', answers_path: round3.answers_path, plan, initialized: false };
  }
  const initialize = options.initialize ?? initializeMyBrain;
  const receipt = initialize({
    answersPath: round3.answers_path,
    workspace: round3.workspace,
    stateRoot: round3.state_root,
    confirmationHash: plan.confirmation_hash,
    hermesConfig: round3.hermes_config,
    gbrainCli: options.gbrainCli,
    force: options.force,
  });
  return { schema_version: 'mybrain-cn-interactive-onboarding-v1', answers_path: round3.answers_path, plan, initialized: true, receipt };
}

export async function runTerminalOnboarding(options: Omit<InteractiveOnboardingOptions, 'io'> = {}) {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error('Interactive onboarding requires a TTY; non-interactive input is refused. Use plan/init with an explicit answers file.');
  }
  const terminal = createInterface({ input: stdin, output: stdout });
  try {
    return await runInteractiveOnboarding({
      ...options,
      io: { ask: (prompt) => terminal.question(prompt), write: (message) => stdout.write(message) },
    });
  } finally {
    terminal.close();
  }
}
