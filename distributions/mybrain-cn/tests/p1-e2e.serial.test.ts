import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBackHash } from '../../../src/core/bootstrap/interview.ts';
import { activateMyBrain, verifyMyBrain } from '../src/activation.ts';
import { createBackup, restoreBackup, verifyBackup } from '../src/backup.ts';
import { readJson, REPO_ROOT } from '../src/common.ts';
import { callVerb, runGbrain } from '../src/gbrain-runtime.ts';
import { buildMeetingPrep, recordCorrection } from '../src/hero-loops.ts';
import { intakeFile } from '../src/intake.ts';
import { runBoundedStdioConformance } from './helpers/bounded-conformance.ts';
import { writeSuccessfulNativeVerifyFixture } from './helpers/native-bootstrap-fixture.ts';

const root = mkdtempSync(join(tmpdir(), 'mybrain-p1-e2e-'));
const workspace = join(root, 'workspace');
const stateRoot = join(root, 'state');
const gbrainCli = join(import.meta.dir, '../../../src/cli.ts');

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('P1 native bootstrap, activation, first loop, correction, and recovery', () => {
  test('native GBrain bootstrap is the only identity path; MyBrain activates schema and skills after render', () => {
    mkdirSync(workspace, { recursive: true });
    runGbrain(
      ['init', '--pglite', '--path', join(stateRoot, '.gbrain', 'brain.pglite'), '--no-embedding', '--skip-embed-check', '--json'],
      { stateRoot, cwd: workspace, gbrainCli },
    );
    runGbrain(['bootstrap', 'interview', '--init'], { stateRoot, cwd: workspace, gbrainCli });
    const answers: Record<string, string> = {
      AGENT_NAME: '远岚',
      PRINCIPAL_NAME: '示例用户',
      AGENT_PURPOSE: '为中国资深管理者保存有来源的职业上下文，并改善会前判断。',
      AGENT_TOP_JOBS: '会前准备；记录决定与承诺；在新会话中读回纠正。',
      PRINCIPAL_CONTEXT: '在中国负责品牌与增长，工作语言是中文和 English，重视证据、边界和可逆判断。',
      PRINCIPAL_TIMEZONE: 'Asia/Shanghai',
      VOICE_REGISTER: '先给结论，再给足以改变决定的证据；中文为主，不说套话。',
      PRINCIPAL_BOUNDARIES: '只导入本人明确选择的资料；公司受限资料与客户秘密默认阻断。',
      ACCESS_TIERS: '个人私密资料仅本人可用；工作资料必须有明确授权和独立来源。',
      SURFACE_PRIMARY: '当前原生 GBrain bootstrap workspace；宿主接入在 bootstrap 后进行。',
      MEMORY_WHAT_MATTERS: '纠正、承诺、关系上下文、决定依据，以及什么会推翻当前判断。',
    };
    for (const [key, value] of Object.entries(answers)) {
      runGbrain(['bootstrap', 'interview', '--set', key, value], { stateRoot, cwd: workspace, gbrainCli });
    }
    const readback = readBackHash(workspace);
    expect(readback.ok).toBe(true);
    if (!readback.ok) throw new Error(readback.message);
    runGbrain(['bootstrap', 'interview', '--show'], { stateRoot, cwd: workspace, gbrainCli });
    runGbrain(['bootstrap', 'interview', '--confirm', readback.hash], { stateRoot, cwd: workspace, gbrainCli });
    runGbrain(['bootstrap', 'render'], { stateRoot, cwd: workspace, gbrainCli });

    const receipt = activateMyBrain({ workspace, stateRoot, gbrainCli });
    expect(receipt.native_confirmation_hash).toBe(readback.hash);
    expect(receipt.skills).toHaveLength(8);
    const brainSource = join(workspace, 'brain');
    mkdirSync(brainSource, { recursive: true });
    runGbrain(['sources', 'add', 'workspace', '--path', brainSource, '--force'], {
      stateRoot, cwd: workspace, gbrainCli,
    });
    expect(existsSync(join(workspace, 'agent.json'))).toBe(true);
    expect(existsSync(join(workspace, 'state', 'interview.json'))).toBe(true);
    expect(existsSync(join(workspace, 'state', 'mybrain-cn.json'))).toBe(true);
    expect(existsSync(join(workspace, 'skills', 'meeting-prep', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(workspace, '.mybrain-init-receipt.json'))).toBe(false);
    expect(existsSync(join(workspace, 'MYBRAIN.md'))).toBe(false);
    expect(existsSync(join(stateRoot, '.gbrain', 'brain.pglite'))).toBe(true);
    writeSuccessfulNativeVerifyFixture({ workspace, stateRoot, activatedAt: receipt.activated_at });
    expect(verifyMyBrain({ workspace, stateRoot, gbrainCli }).ok).toBe(true);

    const gitInit = Bun.spawnSync(['git', 'init'], { cwd: workspace });
    expect(gitInit.exitCode).toBe(0);
    expect(existsSync(join(workspace, '.git'))).toBe(true);

    const schema = runGbrain(['schema', 'validate', 'mybrain-cn-executive'], { stateRoot, gbrainCli });
    expect(schema.code).toBe(0);
  }, 180_000);

  test('distribution CLI has no parallel onboard, plan, or init entry', () => {
    const result = Bun.spawnSync(['bun', join(import.meta.dir, '../src/cli.ts'), '--help']);
    const help = result.stdout.toString();
    expect(result.exitCode).toBe(0);
    expect(help).toContain('mybrain-cn activate');
    expect(help).toContain('GBrain native bootstrap owns');
    expect(help).not.toContain('mybrain-cn onboard');
    expect(help).not.toContain('mybrain-cn plan');
    expect(help).not.toContain('mybrain-cn init');
  });

  test('actual stdio MCP endpoint conforms to the seven-verb contract', () => {
    return runBoundedStdioConformance({
      command: 'bun',
      args: ['run', 'src/cli.ts', 'serve', '--surface', 'verbs'],
      cwd: REPO_ROOT,
      env: { ...process.env, GBRAIN_HOME: stateRoot, GBRAIN_SOURCE: 'workspace', GBRAIN_SWEEP: '0' },
    }).then(({ report, advertised }) => {
      expect(advertised).toEqual(['context_pack', 'delta', 'entity', 'forget', 'recall', 'remember', 'synthesize']);
      expect(report.ok).toBe(true);
      expect(report.failed).toBe(0);
      expect(report.passed).toBeGreaterThan(0);
    });
  }, 180_000);

  test('explicit personal intake syncs and powers the first meeting-prep loop', () => {
    const note = join(root, 'seed-note.md');
    writeFileSync(note, '# 北辰项目会前材料\n\n北辰项目下次会议要确认试点范围。已知风险是数据权限尚未签字。\n');
    const receipt = intakeFile({
      inputPath: note,
      workspace,
      dataClass: 'personal_private',
      stateRoot,
      sync: true,
      gbrainCli,
    });
    expect(receipt.synced).toBe(true);
    const prep = buildMeetingPrep({
      stateRoot,
      sourceId: 'workspace',
      query: '北辰项目 试点范围 数据权限',
      gbrainCli,
    });
    expect(prep.known.length).toBeGreaterThan(0);
    expect(JSON.stringify(prep.known)).toContain('北辰');
    expect(prep.unknowns.length).toBeGreaterThan(0);
  }, 180_000);

  test('restricted data is blocked before a file is staged', () => {
    const blocked = join(root, 'blocked.md');
    writeFileSync(blocked, 'synthetic restricted fixture');
    expect(() => intakeFile({
      inputPath: blocked,
      workspace,
      dataClass: 'client_or_secret',
    })).toThrow('blocked');
    expect(readFileSync(blocked, 'utf8')).toBe('synthetic restricted fixture');
    expect(() => intakeFile({
      inputPath: blocked,
      workspace,
      dataClass: 'work_authorized',
      sourceId: 'work-source',
    })).toThrow('separately registered GBrain source');
  });

  test('correction persists across a fresh process', () => {
    const correction = '北辰项目的试点范围已经改为单一业务单元，不是全公司。';
    const write = recordCorrection({
      stateRoot,
      fact: correction,
      provenance: 'synthetic P1 correction fixture',
      entity: '北辰项目',
      sourceId: 'workspace',
      gbrainCli,
    });
    expect(['inserted', 'superseded', 'duplicate']).toContain(write.status as string);
    const readBack = callVerb('recall', { grep: '单一业务单元', limit: 10 }, { stateRoot, gbrainCli });
    expect(JSON.stringify(readBack)).toContain('单一业务单元');
  }, 180_000);

  test('backup verifies and isolated restore retains correction and pages', () => {
    const backup = join(root, 'backup');
    const manifest = createBackup({ workspace, stateRoot, output: backup });
    expect(manifest.config_credentials_included).toBe(false);
    expect(manifest.database_contains_private_data).toBe(true);
    expect(verifyBackup(backup).files.length).toBeGreaterThan(0);

    const restoredWorkspace = join(root, 'restored-workspace');
    const restoredState = join(root, 'restored-state');
    const receipt = restoreBackup({
      backup,
      targetWorkspace: restoredWorkspace,
      targetStateRoot: restoredState,
    });
    expect(receipt.credentials_restored).toBe(false);
    const corrected = callVerb('recall', { grep: '单一业务单元', limit: 10 }, { stateRoot: restoredState, gbrainCli });
    expect(JSON.stringify(corrected)).toContain('单一业务单元');
    const page = callVerb('recall', { query: '北辰项目 数据权限', limit: 5 }, { stateRoot: restoredState, gbrainCli });
    expect(JSON.stringify(page)).toContain('北辰');
  }, 180_000);
});
