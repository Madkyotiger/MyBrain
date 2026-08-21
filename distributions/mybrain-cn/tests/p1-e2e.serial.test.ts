import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { createBackup, restoreBackup, verifyBackup } from '../src/backup.ts';
import { readJson, REPO_ROOT } from '../src/common.ts';
import { callVerb, runGbrain } from '../src/gbrain-runtime.ts';
import { buildMeetingPrep, recordCorrection } from '../src/hero-loops.ts';
import { intakeFile } from '../src/intake.ts';
import { initializeMyBrain, loadAnswers, onboardingHash } from '../src/onboarding.ts';
import { runBoundedStdioConformance } from './helpers/bounded-conformance.ts';

const root = mkdtempSync(join(tmpdir(), 'mybrain-p1-e2e-'));
const workspace = join(root, 'workspace');
const stateRoot = join(root, 'state');
const hermesConfig = join(root, 'hermes', 'config.yaml');
const answersPath = join(import.meta.dir, '../fixtures/example-answers.json');
const gbrainCli = join(import.meta.dir, '../../../src/cli.ts');

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('P1 fresh install, first loop, correction, and recovery', () => {
  test('fresh init installs schema, eight skills, and isolated Hermes adapter', () => {
    const answers = loadAnswers(answersPath);
    const receipt = initializeMyBrain({
      answersPath,
      workspace,
      stateRoot,
      confirmationHash: onboardingHash(answers),
      hermesConfig,
      gbrainCli,
    });
    expect(receipt.skills_installed).toBe(8);
    expect(existsSync(join(stateRoot, '.gbrain', 'brain.pglite'))).toBe(true);
    expect(existsSync(join(workspace, 'skills', 'meeting-prep', 'SKILL.md'))).toBe(true);
    const parsed = yaml.load(readFileSync(hermesConfig, 'utf8')) as any;
    expect(parsed.mcp_servers.mybrain.args).toEqual([
      'run',
      gbrainCli,
      'serve',
      '--surface',
      'verbs',
      '--source-guard',
    ]);
    const schema = runGbrain(['schema', 'validate', 'mybrain-cn-executive', '--json'], { stateRoot, gbrainCli });
    expect(schema.code).toBe(0);
  }, 180_000);

  test('actual stdio MCP endpoint conforms to the seven-verb contract', () => {
    return runBoundedStdioConformance({
      command: 'bun',
      args: ['run', 'src/cli.ts', 'serve', '--surface', 'verbs'],
      cwd: REPO_ROOT,
      env: { ...process.env, GBRAIN_HOME: stateRoot, GBRAIN_SOURCE: 'default', GBRAIN_SWEEP: '0' },
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
      sourceId: 'default',
      stateRoot,
      sync: true,
      gbrainCli,
    });
    expect(receipt.synced).toBe(true);
    const prep = buildMeetingPrep({ stateRoot, query: '北辰项目 试点范围 数据权限', gbrainCli });
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
      sourceId: 'default',
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
