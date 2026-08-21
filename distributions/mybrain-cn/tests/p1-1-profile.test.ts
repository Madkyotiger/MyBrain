import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import yaml from 'js-yaml';
import { validateP11 } from '../scripts/validate-p1-1.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('P1.1 public Hermes profile', () => {
  test('manifest, config, eight skills, privacy, and acceptance template validate', () => {
    const receipt = validateP11();
    expect(receipt.status).toBe('pass');
    expect(receipt.onboarding_rounds).toBe(3);
    expect(receipt.hermes_skills).toHaveLength(8);
    expect(receipt.human_acceptance_status).toBe('not-run');
  });

  test('current Hermes installs the local distribution with profile install semantics', () => {
    const root = mkdtempSync(join(tmpdir(), 'mybrain-p11-hermes-'));
    roots.push(root);
    const hermesHome = join(root, '.hermes');
    const profileSource = join(import.meta.dir, '../hermes-profile');
    const result = spawnSync('hermes', [
      'profile', 'install', profileSource, '--name', 'mybrain-p11-test', '-y',
    ], {
      encoding: 'utf8',
      env: { ...process.env, HERMES_HOME: hermesHome },
      timeout: 60_000,
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    const installed = join(hermesHome, 'profiles', 'mybrain-p11-test');
    expect(existsSync(join(installed, 'distribution.yaml'))).toBe(true);
    expect(existsSync(join(installed, 'SOUL.md'))).toBe(true);
    expect(existsSync(join(installed, 'skills', 'meeting-prep', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(installed, 'memories'))).toBe(true);
    expect(existsSync(join(installed, 'auth.json'))).toBe(false);
    const config = yaml.load(readFileSync(join(installed, 'config.yaml'), 'utf8')) as any;
    expect(config.mcp_servers.mybrain.args).toContain('${MYBRAIN_GBRAIN_CLI}');
    expect(readFileSync(join(installed, '.env.EXAMPLE'), 'utf8')).toContain('MYBRAIN_GBRAIN_HOME');
  }, 60_000);
});
