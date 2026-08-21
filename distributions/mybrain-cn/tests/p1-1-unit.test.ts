import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInteractiveOnboarding, type OnboardingIO } from '../src/interactive-onboarding.ts';
import { readJson } from '../src/common.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function scripted(values: string[]) {
  const prompts: string[] = [];
  const output: string[] = [];
  const io: OnboardingIO = {
    async ask(prompt) {
      prompts.push(prompt);
      const value = values.shift();
      if (value === undefined) throw new Error(`Test input exhausted at: ${prompt}`);
      return value;
    },
    write(message) { output.push(message); },
  };
  return { io, prompts, output, remaining: values };
}

function completeAnswers(root: string, install: string) {
  return [
    '', '合成测试负责人', '品牌，市场', '中文,English', '合成工作脑', '准备重要会议', 'hermes', '确认',
    'personal_private', 'personal-test', '', '确认',
    'meeting-prep', join(root, 'workspace'), join(root, 'state'), join(root, 'hermes', 'config.yaml'), '', join(root, 'answers.json'), '确认',
    '确认', install,
  ];
}

describe('P1.1 interactive onboarding', () => {
  test('three rounds, final readback, and separate decline save answers without initialization', async () => {
    const root = mkdtempSync(join(tmpdir(), 'mybrain-p11-onboard-'));
    roots.push(root);
    const script = scripted(completeAnswers(root, 'NO'));
    let initialized = 0;
    const result = await runInteractiveOnboarding({
      io: script.io,
      initialize: () => { initialized += 1; return {}; },
    });
    expect(result.initialized).toBe(false);
    expect(initialized).toBe(0);
    expect(script.remaining).toEqual([]);
    expect(script.output.join('\n')).toContain('第 1 轮：用途与运行时回读');
    expect(script.output.join('\n')).toContain('第 2 轮：数据边界与来源回读');
    expect(script.output.join('\n')).toContain('第 3 轮：首个工作流与运行细节回读');
    expect(script.output.join('\n')).toContain('最终完整回读');
    expect(script.output.join('\n')).toContain('confirmation_hash');
    const saved = readJson<any>(join(root, 'answers.json'));
    expect(saved.user.preferred_name).toBe('(未提供)');
    expect(saved.brain.source_id).toBe('personal-test');
    expect(saved.setup.first_workflow).toBe('meeting-prep');
  });

  test('exact INSTALL invokes initialization only after answers and plan exist', async () => {
    const root = mkdtempSync(join(tmpdir(), 'mybrain-p11-install-'));
    roots.push(root);
    const script = scripted(completeAnswers(root, 'INSTALL'));
    let captured: any;
    const result = await runInteractiveOnboarding({
      io: script.io,
      initialize: (options) => {
        expect(existsSync(options.answersPath)).toBe(true);
        expect(options.confirmationHash).toMatch(/^[a-f0-9]{64}$/);
        captured = options;
        return { synthetic: true };
      },
    });
    expect(result.initialized).toBe(true);
    expect(captured.workspace).toBe(join(root, 'workspace'));
    expect((result.receipt as any).synthetic).toBe(true);
  });

  test('required blank and unconfirmed round fail closed without writing answers', async () => {
    const root = mkdtempSync(join(tmpdir(), 'mybrain-p11-closed-'));
    roots.push(root);
    const blank = scripted(['', '']);
    await expect(runInteractiveOnboarding({ io: blank.io, initialize: () => ({}) })).rejects.toThrow('required');
    expect(existsSync(join(root, 'answers.json'))).toBe(false);

    const inputs = completeAnswers(root, 'INSTALL');
    inputs[7] = 'yes';
    const unconfirmed = scripted(inputs);
    await expect(runInteractiveOnboarding({ io: unconfirmed.io, initialize: () => ({}) })).rejects.toThrow('not explicitly confirmed');
    expect(existsSync(join(root, 'answers.json'))).toBe(false);
  });

  test('CLI refuses non-interactive onboarding', () => {
    const cli = join(import.meta.dir, '../src/cli.ts');
    const result = spawnSync('bun', [cli, 'onboard'], { encoding: 'utf8', input: '' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('requires a TTY');
  });
});
