import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { status as interviewStatus, readBackHash } from '../../../src/core/bootstrap/interview.ts';
import { readManifest } from '../../../src/core/bootstrap/format.ts';
import { DISTRIBUTION_DIR, GBRAIN_CLI, readJson, requireAbsolute, writeJson } from './common.ts';
import { runGbrain } from './gbrain-runtime.ts';

export const MYBRAIN_SCHEMA_PACK = 'mybrain-cn-executive';
export const MYBRAIN_SKILLS = [
  'source-grounded-recall',
  'meeting-prep',
  'project-brief',
  'decision-journal',
  'commitment-tracker',
  'relationship-context',
  'weekly-evolution',
  'correction-loop',
] as const;

export interface ActivationOptions {
  workspace: string;
  stateRoot: string;
  gbrainCli?: string;
  force?: boolean;
}

export interface ActivationReceipt {
  schema_version: 'mybrain-cn-activation-v1';
  native_confirmation_hash: string;
  workspace: string;
  state_root: string;
  schema_pack: typeof MYBRAIN_SCHEMA_PACK;
  schema_digest: string;
  skills: string[];
  gbrain_cli: string;
  activated_at: string;
}

function nativeBootstrapProof(workspace: string): { confirmationHash: string; agentName: string } {
  const state = interviewStatus(workspace);
  if (!state.ok) throw new Error(`Native GBrain interview state is invalid: ${state.message}`);
  if (!state.complete || !state.confirmed) {
    throw new Error(
      'Native GBrain bootstrap interview must be complete and confirmed before MyBrain CN activation. ' +
      'Resume with `gbrain bootstrap status` and `gbrain bootstrap interview`.',
    );
  }
  const readback = readBackHash(workspace);
  if (!readback.ok) throw new Error(`Native GBrain read-back hash is unavailable: ${readback.message}`);

  const manifest = readManifest(workspace);
  if (manifest.state !== 'initialized') {
    throw new Error(
      `Native GBrain render must initialize agent.json before MyBrain CN activation (current state: ${manifest.state}).`,
    );
  }
  return { confirmationHash: readback.hash, agentName: manifest.manifest.agent_name };
}

function directoryDigest(root: string): string {
  if (!existsSync(root)) throw new Error(`Directory does not exist: ${root}`);
  const hash = createHash('sha256');
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      const rel = relative(root, path).replaceAll('\\', '/');
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in distribution assets: ${path}`);
      if (entry.isDirectory()) {
        hash.update(`d:${rel}\n`);
        walk(path);
      } else if (entry.isFile()) {
        hash.update(`f:${rel}:${stat.mode & 0o777}\n`);
        hash.update(readFileSync(path));
      } else {
        throw new Error(`Unsupported distribution asset: ${path}`);
      }
    }
  };
  walk(root);
  return hash.digest('hex');
}

function installSchema(stateRoot: string, force: boolean): { digest: string; changed: boolean; backup?: string } {
  const source = join(DISTRIBUTION_DIR, 'schema-packs', MYBRAIN_SCHEMA_PACK);
  const target = join(stateRoot, '.gbrain', 'schema-packs', MYBRAIN_SCHEMA_PACK);
  const digest = directoryDigest(source);
  mkdirSync(join(stateRoot, '.gbrain', 'schema-packs'), { recursive: true });

  if (!existsSync(target)) {
    cpSync(source, target, { recursive: true, errorOnExist: true, force: false });
    return { digest, changed: true };
  }
  if (lstatSync(target).isSymbolicLink()) throw new Error(`Refusing symbolic-link schema target: ${target}`);
  const current = directoryDigest(target);
  if (current === digest) return { digest, changed: false };
  if (!force) {
    throw new Error(
      `Installed ${MYBRAIN_SCHEMA_PACK} differs from this distribution. Review it, then rerun activate with --force to back up and replace it.`,
    );
  }
  const backup = `${target}.backup-${Date.now()}`;
  renameSync(target, backup);
  cpSync(source, target, { recursive: true, errorOnExist: true, force: false });
  return { digest, changed: true, backup };
}

function verifyInstalledSkills(workspace: string): string[] {
  const missing = MYBRAIN_SKILLS.filter((name) => !existsSync(join(workspace, 'skills', name, 'SKILL.md')));
  if (missing.length > 0) throw new Error(`MyBrain CN skills are missing from the native workspace: ${missing.join(', ')}`);
  return [...MYBRAIN_SKILLS];
}

function activeSchemaFromConfig(stateRoot: string): string | null {
  const path = join(stateRoot, '.gbrain', 'config.json');
  if (!existsSync(path)) return null;
  const config = readJson<Record<string, unknown>>(path);
  return typeof config.schema_pack === 'string' ? config.schema_pack : null;
}

export function activateMyBrain(options: ActivationOptions): ActivationReceipt {
  const workspace = requireAbsolute(options.workspace, 'workspace');
  const stateRoot = requireAbsolute(options.stateRoot, 'GBrain state root');
  const gbrainCli = requireAbsolute(options.gbrainCli ?? GBRAIN_CLI, 'GBrain CLI path');
  const native = nativeBootstrapProof(workspace);
  const schema = installSchema(stateRoot, options.force === true);

  runGbrain(['schema', 'validate', MYBRAIN_SCHEMA_PACK], { stateRoot, cwd: workspace, gbrainCli });
  runGbrain(['schema', 'use', MYBRAIN_SCHEMA_PACK], { stateRoot, cwd: workspace, gbrainCli });
  runGbrain(
    ['skillpack', 'scaffold', join(DISTRIBUTION_DIR, 'skill-pack'), '--workspace', workspace, '--trust', '--json'],
    { stateRoot, cwd: workspace, gbrainCli },
  );
  const skills = verifyInstalledSkills(workspace);
  if (activeSchemaFromConfig(stateRoot) !== MYBRAIN_SCHEMA_PACK) {
    throw new Error(`Native GBrain config did not activate schema pack ${MYBRAIN_SCHEMA_PACK}.`);
  }

  const receipt: ActivationReceipt = {
    schema_version: 'mybrain-cn-activation-v1',
    native_confirmation_hash: native.confirmationHash,
    workspace,
    state_root: stateRoot,
    schema_pack: MYBRAIN_SCHEMA_PACK,
    schema_digest: schema.digest,
    skills,
    gbrain_cli: gbrainCli,
    activated_at: new Date().toISOString(),
  };
  writeJson(join(workspace, 'state', 'mybrain-cn.json'), receipt);
  return receipt;
}

export function verifyMyBrain(options: Omit<ActivationOptions, 'force'>) {
  const workspace = requireAbsolute(options.workspace, 'workspace');
  const stateRoot = requireAbsolute(options.stateRoot, 'GBrain state root');
  const gbrainCli = requireAbsolute(options.gbrainCli ?? GBRAIN_CLI, 'GBrain CLI path');
  const native = nativeBootstrapProof(workspace);
  const receiptPath = join(workspace, 'state', 'mybrain-cn.json');
  if (!existsSync(receiptPath)) throw new Error('MyBrain CN activation receipt is missing. Run `mybrain-cn activate`.');
  const receipt = readJson<ActivationReceipt>(receiptPath);
  if (receipt.schema_version !== 'mybrain-cn-activation-v1') throw new Error('Unsupported MyBrain CN activation receipt.');
  if (receipt.native_confirmation_hash !== native.confirmationHash) {
    throw new Error('Native interview answers changed after MyBrain CN activation. Review, reconfirm, and reactivate.');
  }
  if (receipt.workspace !== workspace || receipt.state_root !== stateRoot) {
    throw new Error('Activation receipt belongs to different workspace/state paths.');
  }
  const installedDigest = directoryDigest(join(stateRoot, '.gbrain', 'schema-packs', MYBRAIN_SCHEMA_PACK));
  const distributionDigest = directoryDigest(join(DISTRIBUTION_DIR, 'schema-packs', MYBRAIN_SCHEMA_PACK));
  if (installedDigest !== distributionDigest || receipt.schema_digest !== distributionDigest) {
    throw new Error('Installed Executive schema differs from the active MyBrain CN distribution.');
  }
  if (activeSchemaFromConfig(stateRoot) !== MYBRAIN_SCHEMA_PACK) {
    throw new Error(`${MYBRAIN_SCHEMA_PACK} is not the active native GBrain schema.`);
  }
  const skills = verifyInstalledSkills(workspace);
  const schema = runGbrain(['schema', 'validate', MYBRAIN_SCHEMA_PACK], {
    stateRoot,
    cwd: workspace,
    gbrainCli,
    allowFailure: true,
  });
  if (schema.code !== 0) throw new Error(schema.stderr || schema.stdout || 'Native schema validation failed.');
  return {
    schema_version: 'mybrain-cn-verification-v1',
    ok: true,
    native_bootstrap: { confirmed: true, confirmation_hash: native.confirmationHash, agent_name: native.agentName },
    schema_pack: MYBRAIN_SCHEMA_PACK,
    skills,
    receipt: receiptPath,
  };
}
