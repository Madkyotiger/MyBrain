import { existsSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readManifest, readReceipt } from '../../../src/core/bootstrap/format.ts';
import { listVerifyRuns } from '../../../src/core/bootstrap/status.ts';
import { readJson, requireAbsolute, safeId } from './common.ts';

function canonical(path: string): string {
  return existsSync(path) ? realpathSync(path) : resolve(path);
}

export function resolveNativeSourceId(workspaceInput: string, explicitSourceId?: string): {
  workspace: string;
  sourceId: string;
  nativeSourceId: string;
} {
  const workspace = requireAbsolute(workspaceInput, 'native GBrain workspace');
  const state = readManifest(workspace);
  if (state.state !== 'initialized') {
    throw new Error(`Native GBrain workspace must have an initialized agent.json before host attachment (current state: ${state.state}).`);
  }
  const nativeSourceId = safeId(state.manifest.source_id, 'native workspace source id');
  const sourceId = explicitSourceId ? safeId(explicitSourceId, 'source id') : nativeSourceId;
  return { workspace, sourceId, nativeSourceId };
}

export function requireNativeBootstrapVerified(
  workspaceInput: string,
  stateRootInput: string,
  explicitSourceId?: string,
): {
  workspace: string;
  stateRoot: string;
  sourceId: string;
  nativeSourceId: string;
  verifiedAt: string;
} {
  const stateRoot = requireAbsolute(stateRootInput, 'GBrain state root');
  const native = resolveNativeSourceId(workspaceInput, explicitSourceId);
  const gbrainHome = join(stateRoot, '.gbrain');
  const receipt = readReceipt(gbrainHome);
  if (!receipt) {
    throw new Error('Native GBrain bootstrap receipt is missing. Finish native render/repo/verify before host attachment.');
  }
  if (canonical(receipt.workspace_dir) !== canonical(native.workspace)) {
    throw new Error('Native GBrain bootstrap receipt belongs to a different workspace. Refusing host attachment.');
  }
  if (receipt.source_id !== native.nativeSourceId) {
    throw new Error('Native GBrain receipt source_id does not match agent.json. Refusing host attachment.');
  }

  const activationPath = join(native.workspace, 'state', 'mybrain-cn.json');
  if (!existsSync(activationPath)) {
    throw new Error('MyBrain CN activation receipt is missing. Run `mybrain-cn activate`, then native verify.');
  }
  const activation = readJson<{ activated_at?: string }>(activationPath);
  const activatedAt = activation.activated_at;
  if (!activatedAt || !Number.isFinite(Date.parse(activatedAt))) {
    throw new Error('MyBrain CN activation receipt has no valid activated_at timestamp.');
  }

  const latest = listVerifyRuns(gbrainHome)[0];
  if (!latest?.ok) {
    throw new Error('A successful native `gbrain bootstrap verify` run is required before host attachment.');
  }
  if (!Number.isFinite(Date.parse(latest.ts)) || Date.parse(latest.ts) < Date.parse(activatedAt)) {
    throw new Error('Native bootstrap verify is older than MyBrain CN activation. Re-run `gbrain bootstrap verify`.');
  }
  return { ...native, stateRoot, verifiedAt: latest.ts };
}
