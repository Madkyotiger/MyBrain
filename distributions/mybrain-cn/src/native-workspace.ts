import { readManifest } from '../../../src/core/bootstrap/format.ts';
import { requireAbsolute, safeId } from './common.ts';

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
