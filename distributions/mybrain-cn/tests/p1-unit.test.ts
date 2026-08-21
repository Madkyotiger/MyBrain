import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { configureHermesAdapter } from '../src/hermes-adapter.ts';
import { onboardingHash, onboardingPlan, validateAnswers } from '../src/onboarding.ts';
import { readJson } from '../src/common.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  return readJson(join(import.meta.dir, '../fixtures/example-answers.json'));
}

describe('P1 onboarding and Hermes adapter', () => {
  test('confirmation hash is deterministic and plan is Hermes-first', () => {
    const answers = validateAnswers(fixture());
    const hash = onboardingHash(answers);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(onboardingHash(JSON.parse(JSON.stringify(answers)))).toBe(hash);
    const plan = onboardingPlan(answers, '/tmp/mybrain-workspace', '/tmp/mybrain-state');
    expect(plan.runtime).toBe('hermes');
    expect(plan.actions).toContain('write-explicit-hermes-mcp-adapter');
    expect(plan.blocked_by_default).toContain('client_or_secret');
  });

  test('unsafe answers fail closed', () => {
    const answers = fixture() as any;
    answers.boundaries.external_model_for_personal_private = true;
    expect(() => validateAnswers(answers)).toThrow('external_model_for_personal_private=false');
  });

  test('Hermes adapter preserves unrelated config and exposes verbs only', () => {
    const root = mkdtempSync(join(tmpdir(), 'mybrain-hermes-'));
    roots.push(root);
    const config = join(root, 'config.yaml');
    writeFileSync(config, 'model: existing\nmcp_servers:\n  other:\n    command: other\n');
    const receipt = configureHermesAdapter({
      configPath: config,
      stateRoot: join(root, 'state'),
      sourceId: 'default',
    });
    const parsed = yaml.load(readFileSync(config, 'utf8')) as any;
    expect(parsed.model).toBe('existing');
    expect(parsed.mcp_servers.other.command).toBe('other');
    expect(parsed.mcp_servers.mybrain.command).toBe('bun');
    expect(parsed.mcp_servers.mybrain.args).toContain('verbs');
    expect(parsed.mcp_servers.mybrain.args).toContain('--source-guard');
    expect(parsed.mcp_servers.mybrain.resources).toBe(false);
    expect(receipt.backup_path).not.toBeNull();
  });
});
