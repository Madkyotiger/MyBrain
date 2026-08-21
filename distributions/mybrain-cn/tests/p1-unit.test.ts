import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { configureHermesAdapter } from '../src/hermes-adapter.ts';
import { MYBRAIN_SCHEMA_PACK, MYBRAIN_SKILLS, verifyMyBrain } from '../src/activation.ts';
import { readJson } from '../src/common.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('P1 native-bootstrap overlay and Hermes attachment', () => {
  test('distribution skillpack uses the native third-party manifest contract', () => {
    const root = join(import.meta.dir, '../skill-pack');
    const manifest = readJson<any>(join(root, 'skillpack.json'));
    expect(manifest.api_version).toBe('gbrain-skillpack-v1');
    expect(manifest.schema_pack).toBe(MYBRAIN_SCHEMA_PACK);
    expect(manifest.skills).toEqual(MYBRAIN_SKILLS.map((name) => `skills/${name}`));
    for (const name of MYBRAIN_SKILLS) {
      expect(existsSync(join(root, 'skills', name, 'SKILL.md'))).toBe(true);
    }
  });

  test('distribution verification refuses a workspace that skipped native bootstrap', () => {
    const root = mkdtempSync(join(tmpdir(), 'mybrain-native-gate-'));
    roots.push(root);
    expect(() => verifyMyBrain({ workspace: join(root, 'workspace'), stateRoot: join(root, 'state') }))
      .toThrow('Native GBrain');
  });

  test('Hermes attachment preserves unrelated config and exposes verbs only', () => {
    const root = mkdtempSync(join(tmpdir(), 'mybrain-hermes-'));
    roots.push(root);
    const config = join(root, 'config.yaml');
    const workspace = join(root, 'workspace');
    mkdirSync(workspace);
    writeFileSync(join(workspace, 'agent.json'), JSON.stringify({
      format_version: 1,
      initialized: true,
      agent_name: 'test',
      created_by: 'test',
      created_at: '2026-08-21T00:00:00.000Z',
      source_id: 'workspace',
    }));
    writeFileSync(config, 'model: existing\nmcp_servers:\n  other:\n    command: other\n');
    const receipt = configureHermesAdapter({
      configPath: config,
      stateRoot: join(root, 'state'),
      workspace,
    });
    const parsed = yaml.load(readFileSync(config, 'utf8')) as any;
    expect(parsed.model).toBe('existing');
    expect(parsed.mcp_servers.other.command).toBe('other');
    expect(parsed.mcp_servers.mybrain.command).toBe('bun');
    expect(parsed.mcp_servers.mybrain.args).toContain('verbs');
    expect(parsed.mcp_servers.mybrain.args.slice(0, 2)).toEqual(['run', expect.any(String)]);
    expect(parsed.mcp_servers.mybrain.args).toContain('--source-guard');
    expect(parsed.mcp_servers.mybrain.env.GBRAIN_SOURCE).toBe('workspace');
    expect(parsed.mcp_servers.mybrain.resources).toBe(false);
    expect(receipt.backup_path).not.toBeNull();
  });
});
