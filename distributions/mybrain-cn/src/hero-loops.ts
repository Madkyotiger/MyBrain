import { callVerb } from './gbrain-runtime.ts';
import {
  asRecordArray,
  collectEvidenceWorkflow,
  type EvidenceKind,
  type EvidenceReference,
  type VerbCaller,
} from './evidence-workflow.ts';

export interface CorrectionReceipt extends Record<string, unknown> {
  verification: {
    verified: true;
    fact_id: string;
    provenance: string;
  } | {
    verified: false;
    fact_id: string;
    provenance: string;
    reason: 'duplicate_read_back_not_available';
  };
}

export interface LoopOptions {
  stateRoot: string;
  query: string;
  gbrainCli?: string;
  sourceId?: string;
  since?: string;
  sinceSlug?: string;
  entity?: string;
  now?: Date;
  caller?: VerbCaller;
}

type PresentedEvidence = {
  evidence_id: string;
  title: string;
  excerpt: string;
  source: string;
  entity_slug: string | null;
  provenance: string | null;
  visibility: string | null;
  fact: string;
  freshness: EvidenceReference['freshness'];
  current: boolean;
  claimable: boolean;
};

function present(item: EvidenceReference): PresentedEvidence {
  return {
    evidence_id: item.evidence_id,
    title: item.title,
    excerpt: item.excerpt,
    source: item.source,
    entity_slug: item.entity_slug,
    provenance: item.provenance,
    visibility: item.visibility,
    fact: item.excerpt,
    freshness: item.freshness,
    current: item.current,
    claimable: item.claimable,
  };
}

function byKind(items: EvidenceReference[], kind: EvidenceKind): PresentedEvidence[] {
  return items.filter((item) => item.current && item.claimable && item.kind === kind).map(present);
}

function qualityReceipt(claims: Array<{ evidence_ids: string[] }>) {
  const unboundClaims = claims.filter((claim) => claim.evidence_ids.length === 0).length;
  return {
    grounded_claims: claims.length - unboundClaims,
    unbound_claims: unboundClaims,
    claim_grounding_rate: claims.length === 0 ? null : (claims.length - unboundClaims) / claims.length,
  };
}

export function buildMeetingPrep(options: LoopOptions) {
  const workflow = collectEvidenceWorkflow({
    workflow: 'meeting-prep',
    stateRoot: options.stateRoot,
    query: options.query,
    gbrainCli: options.gbrainCli,
    sourceId: options.sourceId,
    entity: options.entity,
    now: options.now,
    caller: options.caller,
  });
  const known = workflow.evidence
    .filter((item) => item.record_type === 'result' && item.current && item.claimable)
    .slice(0, 5)
    .map(present);
  const commitments = byKind(workflow.evidence, 'commitment');
  const decisions = byKind(workflow.evidence, 'decision');
  const changes = workflow.evidence
    .filter((item) => item.current && item.claimable && (item.kind === 'correction' || item.kind === 'signal'))
    .map(present);

  return {
    schema_version: 'mybrain-cn-meeting-prep-v1',
    query: workflow.query,
    known,
    commitments,
    decisions,
    changes,
    claims: workflow.claims,
    evidence: workflow.evidence,
    sources: workflow.sources,
    unknowns: workflow.unknowns.length > 0
      ? workflow.unknowns
      : ['本输出只代表已导入且当前可访问的材料；未导入资料不在结论范围内。'],
    next_move: known.length === 0
      ? '补一份用户明确选择、权限清楚的会前材料。'
      : commitments.length === 0
        ? '先在会议中确认负责人、期限和未完成承诺，再推进一个明确结果。'
        : decisions.length === 0
          ? '先确认哪些事项已经决定、哪些仍可反转，再推动本次会议结果。'
          : '先核对最近变化与未完成承诺，再推动一个明确结果。',
    retrieval: workflow.retrieval,
    quality: qualityReceipt(workflow.claims),
  };
}

export function buildProjectBrief(options: LoopOptions) {
  const workflow = collectEvidenceWorkflow({
    workflow: 'project-brief',
    stateRoot: options.stateRoot,
    query: options.query,
    gbrainCli: options.gbrainCli,
    sourceId: options.sourceId,
    entity: options.entity,
    now: options.now,
    caller: options.caller,
  });
  const currentTruth = workflow.evidence.filter((item) => item.current && item.claimable).slice(0, 8).map(present);
  const decisions = byKind(workflow.evidence, 'decision');
  const commitments = byKind(workflow.evidence, 'commitment');
  const signals = byKind(workflow.evidence, 'signal');
  const corrections = byKind(workflow.evidence, 'correction');
  const objective = workflow.evidence.find((item) => (
    item.current && item.claimable && /(?:目标|成功条件|objective|success condition)/i.test(item.excerpt)
  ));

  return {
    schema_version: 'mybrain-cn-project-brief-v1',
    query: workflow.query,
    objective: objective ? present(objective) : null,
    current_truth: currentTruth,
    decisions,
    commitments,
    signals,
    corrections,
    claims: workflow.claims,
    evidence: workflow.evidence,
    sources: workflow.sources,
    unknowns: objective
      ? workflow.unknowns
      : ['未找到可验证的项目目标或成功条件。', ...workflow.unknowns],
    next_move: objective === undefined
      ? '先确认项目目标与成功条件，再补决定、负责人和反转条件。'
      : decisions.length === 0
        ? '确认当前已定事项、仍开放的选择，以及会触发反转的证据。'
        : commitments.length === 0
          ? '把下一步转成带负责人和期限的明确承诺。'
          : '核对最新决定、风险和承诺，然后指定一个 owner-ready 下一步。',
    retrieval: workflow.retrieval,
    quality: qualityReceipt(workflow.claims),
  };
}

export function buildWeeklyEvolution(options: LoopOptions) {
  const workflow = collectEvidenceWorkflow({
    workflow: 'weekly-evolution',
    stateRoot: options.stateRoot,
    query: options.query,
    since: options.since,
    sinceSlug: options.sinceSlug,
    gbrainCli: options.gbrainCli,
    sourceId: options.sourceId,
    now: options.now,
    caller: options.caller,
  });

  return {
    schema_version: 'mybrain-cn-weekly-evolution-v1',
    query: workflow.query,
    since: workflow.retrieval.since,
    new_evidence: byKind(workflow.evidence, 'context'),
    decisions: byKind(workflow.evidence, 'decision'),
    commitments: byKind(workflow.evidence, 'commitment'),
    corrections: byKind(workflow.evidence, 'correction'),
    signals: byKind(workflow.evidence, 'signal'),
    claims: workflow.claims,
    evidence: workflow.evidence,
    sources: workflow.sources,
    unknowns: workflow.unknowns,
    next_move: workflow.claims.length === 0
      ? '确认本周是否有未导入的决定、承诺或纠正，不要把空检索解释成没有变化。'
      : '选择一个已改变的判断、一个仍缺证据的判断，并明确下周要改变的一项行为。',
    retrieval: workflow.retrieval,
    quality: qualityReceipt(workflow.claims),
  };
}

function normalizedFact(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function recordCorrection(options: {
  stateRoot: string;
  fact: string;
  provenance: string;
  entity?: string;
  gbrainCli?: string;
  sourceId?: string;
  caller?: VerbCaller;
}): CorrectionReceipt {
  const caller = options.caller ?? callVerb;
  const runtime = {
    stateRoot: options.stateRoot,
    gbrainCli: options.gbrainCli,
    sourceId: options.sourceId,
  };
  const write = caller('remember', {
    fact: options.fact,
    provenance: options.provenance,
    entity: options.entity,
    kind: 'belief',
    visibility: 'world',
  }, runtime);
  const recallParams = {
    grep: options.fact,
    ...(options.entity ? { entity: options.entity } : {}),
    limit: 20,
  };
  const readBack = caller('recall', recallParams, runtime);
  const target = normalizedFact(options.fact);
  const expectedId = typeof write.id === 'string' || typeof write.id === 'number' ? String(write.id) : null;
  if (!expectedId) {
    throw new Error('Correction write completed without a fact id; read-back identity cannot be verified.');
  }
  const candidates = asRecordArray(readBack.facts).filter((item) => {
    const fact = typeof item.fact === 'string' ? normalizedFact(item.fact) : '';
    if (!fact) return false;
    return fact === target;
  });
  const matched = candidates.find((item) => (
    typeof item.fact_id === 'string' && item.fact_id === expectedId
  ));
  if (!matched) {
    if (write.status === 'duplicate') {
      return {
        ...write,
        verification: {
          verified: false,
          fact_id: expectedId,
          provenance: options.provenance,
          reason: 'duplicate_read_back_not_available',
        },
      };
    }
    throw new Error('Correction write completed, but a fresh recall did not verify the corrected fact.');
  }
  return {
    ...write,
    verification: {
      verified: true,
      fact_id: matched.fact_id as string,
      provenance: typeof matched.provenance === 'string' ? matched.provenance : options.provenance,
    },
  };
}
