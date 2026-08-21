import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { parse as parseJsonc } from 'jsonc-parser';
import { configureWorkBuddyAdapter } from '../src/workbuddy-adapter.ts';
import { configureDeepSeekHarnessAdapter } from '../src/deepseek-harness-adapter.ts';
import { createDoubaoWorkHandoff } from '../src/doubao-work-handoff.ts';
import { validateAnswers } from '../src/onboarding.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function root(name: string): string {
  const value = mkdtempSync(join(tmpdir(), name));
  roots.push(value);
  return value;
}

function answers(runtime: 'workbuddy' | 'deepseek-harness', base: string) {
  return {
    schema_version: 'mybrain-cn-onboarding-v1',
    user: { preferred_name: '合成用户', role: '品牌负责人', domains: ['品牌'], working_languages: ['中文'] },
    brain: { name: '合成 Brain', primary_jobs: ['会前准备'], default_runtime: runtime, source_id: 'default' },
    boundaries: {
      allowed_data_classes: ['personal_private'],
      blocked_data_classes: ['org_restricted', 'client_or_secret'],
      external_model_for_personal_private: false,
    },
    setup: {
      initial_data_class: 'personal_private', first_workflow: 'meeting-prep',
      workspace: join(base, 'workspace'), state_root: join(base, 'state'),
      ...(runtime === 'workbuddy'
        ? { workbuddy_config: join(base, '.mcp.json') }
        : { deepseek_harness_patch: join(base, 'cordis.patch.yml') }),
    },
  };
}

describe('P1.2 China agent host adapters', () => {
  test('WorkBuddy preserves JSONC comments and unrelated servers, backs up, and refuses silent replacement', () => {
    const base = root('mybrain-workbuddy-');
    const config = join(base, '.mcp.json');
    const original = '{\n  // keep this comment\n  "mcpServers": { "existing": { "type": "stdio", "command": "keep" } }\n}\n';
    writeFileSync(config, original);
    const receipt = configureWorkBuddyAdapter({ configPath: config, stateRoot: join(base, 'state') });
    const rendered = readFileSync(config, 'utf8');
    const parsed = parseJsonc(rendered) as any;
    expect(rendered).toContain('// keep this comment');
    expect(parsed.mcpServers.existing.command).toBe('keep');
    expect(parsed.mcpServers.mybrain.type).toBe('stdio');
    expect(parsed.mcpServers.mybrain.args).toEqual(expect.arrayContaining(['verbs', '--source-guard']));
    expect(readFileSync(receipt.backup_path!, 'utf8')).toBe(original);
    expect(() => configureWorkBuddyAdapter({ configPath: config, stateRoot: join(base, 'state') })).toThrow('already exists');
  });

  test('DeepSeek Harness preserves unrelated patch operations and inserts official MCP client config', () => {
    const base = root('mybrain-dsh-');
    const patch = join(base, 'cordis.patch.yml');
    const original = '- insert:\n    - id: existing-plugin\n      name: example-plugin\n      config:\n        keep: true\n';
    writeFileSync(patch, original);
    const receipt = configureDeepSeekHarnessAdapter({
      patchPath: patch, stateRoot: join(base, 'state'), workspace: join(base, 'workspace'),
    });
    const parsed = yaml.load(readFileSync(patch, 'utf8')) as any[];
    const entries = parsed.flatMap((operation) => operation.insert ?? []);
    expect(entries.find((entry) => entry.id === 'existing-plugin').config.keep).toBe(true);
    const mybrain = entries.find((entry) => entry.id === 'mybrain-mcp');
    expect(mybrain.name).toBe('@deepseek-ai/dsh-mcp-client');
    expect(mybrain.config.transport).toBe('stdio');
    expect(mybrain.config.args).toEqual(expect.arrayContaining(['verbs', '--source-guard']));
    expect(readFileSync(receipt.backup_path!, 'utf8')).toBe(original);
    expect(() => configureDeepSeekHarnessAdapter({
      patchPath: patch, stateRoot: join(base, 'state'), workspace: join(base, 'workspace'),
    })).toThrow('already exists');
  });

  test('Doubao Work produces a credential-free remote registration handoff and rejects unsafe endpoints', () => {
    const base = root('mybrain-doubao-');
    const output = join(base, 'registration.json');
    const receipt = createDoubaoWorkHandoff({ endpointUrl: 'https://brain.example.com/mcp', outputPath: output });
    const handoff = JSON.parse(readFileSync(output, 'utf8'));
    expect(receipt.deployment_included).toBe(false);
    expect(handoff.registration.transport).toBe('streamable-http');
    expect(handoff.registration.visibility).toBe('self-only');
    expect(handoff.registration.authentication.value).toContain('secret-field');
    expect(JSON.stringify(handoff)).not.toContain('Bearer ');
    expect(() => createDoubaoWorkHandoff({ endpointUrl: 'http://brain.example.com/mcp', outputPath: output })).toThrow('HTTPS');
    expect(() => createDoubaoWorkHandoff({ endpointUrl: 'https://127.0.0.1/mcp', outputPath: output })).toThrow('private-network');
    expect(() => createDoubaoWorkHandoff({ endpointUrl: 'https://user:pass@brain.example.com/mcp', outputPath: output })).toThrow('Credentials');
  });

  test('onboarding accepts WorkBuddy and DeepSeek Harness only with explicit host paths', () => {
    const base = root('mybrain-host-onboarding-');
    expect(validateAnswers(answers('workbuddy', base) as any).brain.default_runtime).toBe('workbuddy');
    expect(validateAnswers(answers('deepseek-harness', base) as any).brain.default_runtime).toBe('deepseek-harness');
    const missing = answers('workbuddy', base) as any;
    delete missing.setup.workbuddy_config;
    expect(() => validateAnswers(missing)).toThrow('workbuddy_config');
  });
});
