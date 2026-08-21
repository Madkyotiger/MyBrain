import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { parse as parseJsonc } from 'jsonc-parser';
import { configureWorkBuddyAdapter } from '../src/workbuddy-adapter.ts';
import { configureDeepSeekHarnessAdapter } from '../src/deepseek-harness-adapter.ts';
import { createFeishuAilyHandoff } from '../src/feishu-aily-handoff.ts';
import { writeSuccessfulNativeVerifyFixture } from './helpers/native-bootstrap-fixture.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function root(name: string): string {
  const value = mkdtempSync(join(tmpdir(), name));
  roots.push(value);
  return value;
}

function nativeWorkspace(base: string): { workspace: string; stateRoot: string } {
  const workspace = join(base, 'workspace');
  const stateRoot = join(base, 'state');
  writeSuccessfulNativeVerifyFixture({ workspace, stateRoot });
  return { workspace, stateRoot };
}

describe('release-candidate post-bootstrap China agent host adapters', () => {
  test('WorkBuddy preserves JSONC comments and unrelated servers, backs up, and refuses silent replacement', () => {
    const base = root('mybrain-workbuddy-');
    const { workspace, stateRoot } = nativeWorkspace(base);
    const config = join(base, '.mcp.json');
    const original = '{\n  // keep this comment\n  "mcpServers": { "existing": { "type": "stdio", "command": "keep" } }\n}\n';
    writeFileSync(config, original);
    const receipt = configureWorkBuddyAdapter({ configPath: config, stateRoot, workspace });
    const rendered = readFileSync(config, 'utf8');
    const parsed = parseJsonc(rendered) as any;
    expect(rendered).toContain('// keep this comment');
    expect(parsed.mcpServers.existing.command).toBe('keep');
    expect(parsed.mcpServers.mybrain.type).toBe('stdio');
    expect(parsed.mcpServers.mybrain.args).toEqual(expect.arrayContaining(['verbs', '--source-guard']));
    expect(parsed.mcpServers.mybrain.env.GBRAIN_SOURCE).toBe('workspace');
    expect(readFileSync(receipt.backup_path!, 'utf8')).toBe(original);
    expect(() => configureWorkBuddyAdapter({ configPath: config, stateRoot, workspace })).toThrow('already exists');
  });

  test('DeepSeek Harness preserves unrelated patch operations and follows the native workspace source', () => {
    const base = root('mybrain-dsh-');
    const { workspace, stateRoot } = nativeWorkspace(base);
    const patch = join(base, 'cordis.patch.yml');
    const original = '- insert:\n    - id: existing-plugin\n      name: example-plugin\n      config:\n        keep: true\n';
    writeFileSync(patch, original);
    const receipt = configureDeepSeekHarnessAdapter({ patchPath: patch, stateRoot, workspace });
    const parsed = yaml.load(readFileSync(patch, 'utf8')) as any[];
    const entries = parsed.flatMap((operation) => operation.insert ?? []);
    expect(entries.find((entry) => entry.id === 'existing-plugin').config.keep).toBe(true);
    const mybrain = entries.find((entry) => entry.id === 'mybrain-mcp');
    expect(mybrain.name).toBe('@deepseek-ai/dsh-mcp-client');
    expect(mybrain.config.transport).toBe('stdio');
    expect(mybrain.config.args).toEqual(expect.arrayContaining(['verbs', '--source-guard']));
    expect(mybrain.config.env.GBRAIN_SOURCE).toBe('workspace');
    expect(readFileSync(receipt.backup_path!, 'utf8')).toBe(original);
    expect(() => configureDeepSeekHarnessAdapter({ patchPath: patch, stateRoot, workspace })).toThrow('already exists');
  });

  test('host adapters refuse attachment before native verify succeeds after activation', () => {
    const base = root('mybrain-preverify-');
    const workspace = join(base, 'workspace');
    const stateRoot = join(base, 'state');
    mkdirSync(join(workspace, 'state'), { recursive: true });
    writeFileSync(join(workspace, 'agent.json'), JSON.stringify({
      format_version: 1,
      initialized: true,
      agent_name: 'test',
      created_by: 'test',
      created_at: '2026-08-21T00:00:00.000Z',
      source_id: 'workspace',
    }));
    writeFileSync(join(workspace, 'state', 'mybrain-cn.json'), JSON.stringify({
      activated_at: '2026-08-21T00:00:00.000Z',
    }));
    expect(() => configureWorkBuddyAdapter({
      configPath: join(base, '.mcp.json'), stateRoot, workspace,
    })).toThrow('receipt is missing');
  });

  test('Feishu Aily produces a credential-free remote registration handoff and rejects unsafe endpoints', () => {
    const base = root('mybrain-feishu-aily-');
    const output = join(base, 'registration.json');
    const receipt = createFeishuAilyHandoff({ endpointUrl: 'https://brain.example.com/mcp', outputPath: output });
    const handoff = JSON.parse(readFileSync(output, 'utf8'));
    expect(receipt.deployment_included).toBe(false);
    expect(handoff.product).toBe('Feishu Aily');
    expect(handoff.registration.transport).toBe('streamable-http');
    expect(handoff.registration.visibility).toBe('self-only');
    expect(handoff.registration.authentication.value).toContain('secret-field');
    expect(JSON.stringify(handoff)).not.toContain('Bearer ');
    expect(() => createFeishuAilyHandoff({ endpointUrl: 'http://brain.example.com/mcp', outputPath: output })).toThrow('HTTPS');
    expect(() => createFeishuAilyHandoff({ endpointUrl: 'https://127.0.0.1/mcp', outputPath: output })).toThrow('private-network');
    expect(() => createFeishuAilyHandoff({ endpointUrl: 'https://user:pass@brain.example.com/mcp', outputPath: output })).toThrow('Credentials');
  });

  test('host adapters are post-bootstrap attachments, not alternate onboarding state machines', () => {
    const cli = readFileSync(join(import.meta.dir, '../src/cli.ts'), 'utf8');
    expect(cli).toContain("case 'activate'");
    expect(cli).toContain("runtime === 'workbuddy'");
    expect(cli).toContain("runtime === 'deepseek-harness'");
    expect(cli).not.toContain("case 'onboard'");
    expect(cli).not.toContain("case 'plan'");
    expect(cli).not.toContain("case 'init'");
  });
});
