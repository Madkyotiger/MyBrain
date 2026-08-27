import { createHash } from 'node:crypto';
import { callVerb, type RunGbrainOptions } from './gbrain-runtime.ts';

export type EvidenceWorkflowName = 'meeting-prep' | 'project-brief' | 'weekly-evolution';
export type EvidenceKind = 'context' | 'commitment' | 'decision' | 'correction' | 'signal';
export type EvidenceFreshness = 'current' | 'possibly_stale' | 'superseded' | 'unknown';

export type VerbCaller = (
  verb: string,
  params: Record<string, unknown>,
  options: RunGbrainOptions,
) => Record<string, unknown>;

export interface EvidenceReference {
  evidence_id: string;
  kind: EvidenceKind;
  title: string;
  excerpt: string;
  source: string;
  provenance: string | null;
  fact_id: string | null;
  observed_at: string | null;
  freshness: EvidenceFreshness;
  current: boolean;
  match_reason: string | null;
  query_slot: string;
}

export interface GroundedClaim {
  claim_id: string;
  text: string;
  kind: 'fact';
  evidence_ids: string[];
  freshness: EvidenceFreshness;
}

export interface EvidenceCoverage {
  context: number;
  commitment: number;
  decision: number;
  correction: number;
  signal: number;
}

export interface EvidenceRetrievalReceipt {
  protocol_version: unknown;
  degraded: boolean;
  dropped_count: number;
  attempted_queries: string[];
  calls: number;
  coverage: EvidenceCoverage;
  has_more: boolean;
  since: string | null;
  entity: string | null;
}

export interface EvidenceWorkflowResult {
  workflow: EvidenceWorkflowName;
  query: string;
  evidence: EvidenceReference[];
  claims: GroundedClaim[];
  unknowns: string[];
  sources: string[];
  retrieval: EvidenceRetrievalReceipt;
}

export interface EvidenceWorkflowOptions {
  workflow: EvidenceWorkflowName;
  stateRoot: string;
  query: string;
  gbrainCli?: string;
  since?: string;
  entity?: string;
  now?: Date;
  maxCalls?: number;
  caller?: VerbCaller;
}

type RecordLike = Record<string, unknown>;

type RecallSlot = {
  name: string;
  suffix: string;
  needed: (coverage: EvidenceCoverage) => boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const RECALL_SLOTS: Record<Exclude<EvidenceWorkflowName, 'weekly-evolution'>, RecallSlot[]> = {
  'meeting-prep': [
    {
      name: 'commitments',
      suffix: '承诺 截止时间 负责人 follow-up',
      needed: (coverage) => coverage.commitment === 0,
    },
    {
      name: 'decisions-and-changes',
      suffix: '决定 风险 分歧 纠正 变化',
      needed: (coverage) => coverage.decision === 0 || (coverage.correction === 0 && coverage.signal === 0),
    },
  ],
  'project-brief': [
    {
      name: 'decisions',
      suffix: '目标 成功条件 决定 反转条件',
      needed: (coverage) => coverage.decision === 0,
    },
    {
      name: 'commitments-and-risks',
      suffix: '承诺 负责人 截止时间 依赖 风险',
      needed: (coverage) => coverage.commitment === 0 || coverage.signal === 0,
    },
    {
      name: 'corrections',
      suffix: '纠正 更新 变化 已失效',
      needed: (coverage) => coverage.correction === 0,
    },
  ],
};

function isRecord(value: unknown): value is RecordLike {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function asRecordArray(value: unknown): RecordLike[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function firstString(record: RecordLike, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stableId(prefix: string, values: Array<string | null>): string {
  const input = values.filter((value): value is string => Boolean(value)).join('\n');
  return `${prefix}-${createHash('sha256').update(input).digest('hex').slice(0, 16)}`;
}

function classifyEvidence(record: RecordLike): EvidenceKind {
  const kind = firstString(record, ['kind', 'type', 'page_type'])?.toLowerCase() ?? '';
  const slug = firstString(record, ['slug', 'provenance'])?.toLowerCase() ?? '';
  const provenance = firstString(record, ['provenance'])?.toLowerCase() ?? '';

  if (kind === 'commitment' || slug.startsWith('commitments/')) return 'commitment';
  if (kind === 'decision' || slug.startsWith('decisions/')) return 'decision';
  if (kind === 'signal' || slug.startsWith('signals/')) return 'signal';
  if (
    kind === 'correction'
    || slug.startsWith('corrections/')
    || provenance.includes('correction')
    || provenance.includes('纠正')
  ) return 'correction';
  return 'context';
}

function parseDate(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function evidenceFreshness(record: RecordLike, now: Date): EvidenceFreshness {
  const status = firstString(record, ['status'])?.toLowerCase();
  if (status === 'superseded' || firstString(record, ['superseded_by', 'superseded_by_id'])) {
    return 'superseded';
  }
  const validUntil = parseDate(firstString(record, ['valid_until', 'valid_to', 'expires_at']));
  if (validUntil !== null && validUntil < now.getTime()) return 'possibly_stale';
  if (firstString(record, ['updated_at', 'observed_at', 'effective_at', 'created_at', 'recorded_at'])) {
    return 'current';
  }
  return 'unknown';
}

function normalizeEvidence(record: RecordLike, slot: string, now: Date): EvidenceReference | null {
  const excerpt = compactText(firstString(record, ['chunk', 'fact', 'text', 'summary', 'title']) ?? '');
  if (!excerpt) return null;
  const title = compactText(firstString(record, ['title', 'entity_title', 'slug', 'fact']) ?? '未命名证据');
  const source = firstString(record, ['slug', 'provenance', 'source_id']) ?? 'unknown';
  const provenance = firstString(record, ['provenance']);
  const factId = firstString(record, ['fact_id', 'id']);
  const observedAt = firstString(record, ['updated_at', 'observed_at', 'effective_at', 'created_at', 'recorded_at']);
  const freshness = evidenceFreshness(record, now);
  const evidenceId = stableId('ev', [factId, source, excerpt]);

  return {
    evidence_id: evidenceId,
    kind: classifyEvidence(record),
    title,
    excerpt,
    source,
    provenance,
    fact_id: factId,
    observed_at: observedAt,
    freshness,
    current: freshness !== 'superseded' && freshness !== 'possibly_stale',
    match_reason: firstString(record, ['evidence', 'match_reason']),
    query_slot: slot,
  };
}

function evidenceFromEnvelope(envelope: RecordLike, slot: string, now: Date): EvidenceReference[] {
  const records = [
    ...asRecordArray(envelope.results),
    ...asRecordArray(envelope.pages),
    ...asRecordArray(envelope.facts),
    ...asRecordArray(envelope.threads),
  ];
  return records
    .map((record) => normalizeEvidence(record, slot, now))
    .filter((item): item is EvidenceReference => item !== null);
}

function dedupeEvidence(items: EvidenceReference[]): EvidenceReference[] {
  const byId = new Map<string, EvidenceReference>();
  const byContent = new Set<string>();
  for (const item of items) {
    const contentKey = `${item.kind}\n${item.source}\n${item.excerpt}`;
    if (byId.has(item.evidence_id) || byContent.has(contentKey)) continue;
    byId.set(item.evidence_id, item);
    byContent.add(contentKey);
  }
  return [...byId.values()];
}

function coverageFor(items: EvidenceReference[]): EvidenceCoverage {
  const coverage: EvidenceCoverage = {
    context: 0,
    commitment: 0,
    decision: 0,
    correction: 0,
    signal: 0,
  };
  for (const item of items) coverage[item.kind] += 1;
  return coverage;
}

function buildUnknowns(workflow: EvidenceWorkflowName, coverage: EvidenceCoverage): string[] {
  const unknowns: string[] = [];
  if (workflow === 'weekly-evolution') {
    if (Object.values(coverage).every((count) => count === 0)) {
      unknowns.push('当前时间窗口没有可验证的变化；不要把“没有找到”改写成“没有发生”。');
    }
    if (coverage.correction === 0) unknowns.push('未找到本周期内的明确纠正记录。');
    return unknowns;
  }

  if (coverage.context === 0) unknowns.push('未找到足够的当前背景材料。');
  if (coverage.decision === 0) unknowns.push('未找到明确的已定事项或反转条件。');
  if (coverage.commitment === 0) unknowns.push('未找到带负责人或期限的当前承诺。');
  if (workflow === 'project-brief' && coverage.signal === 0) {
    unknowns.push('未找到可验证的风险、变化或弱信号。');
  }
  return unknowns;
}

function claimsFromEvidence(items: EvidenceReference[]): GroundedClaim[] {
  return items
    .filter((item) => item.current)
    .slice(0, 20)
    .map((item) => ({
      claim_id: stableId('claim', [item.evidence_id, item.excerpt]),
      text: item.excerpt,
      kind: 'fact' as const,
      evidence_ids: [item.evidence_id],
      freshness: item.freshness,
    }));
}

function uniqueSources(items: EvidenceReference[]): string[] {
  return [...new Set(items.map((item) => item.source).filter((source) => source !== 'unknown'))];
}

function normalizedSince(options: EvidenceWorkflowOptions, now: Date): string {
  if (options.since?.trim()) {
    const parsed = Date.parse(options.since);
    if (!Number.isFinite(parsed)) throw new Error(`Invalid --since timestamp: ${options.since}`);
    return new Date(parsed).toISOString();
  }
  return new Date(now.getTime() - 7 * DAY_MS).toISOString();
}

function queryWithSuffix(query: string, suffix: string): string {
  return compactText(`${query} ${suffix}`);
}

function inferredEntity(query: string, explicit?: string): string | null {
  if (explicit?.trim()) return compactText(explicit);
  const stopwords = new Set(['关于', '本周', '项目', '会议', '客户', '情况', '最新']);
  const token = query
    .split(/\s+/)
    .map((item) => item.trim())
    .find((item) => item.length >= 2 && item.length <= 48 && !stopwords.has(item));
  return token ?? null;
}

export function collectEvidenceWorkflow(options: EvidenceWorkflowOptions): EvidenceWorkflowResult {
  const query = compactText(options.query);
  if (!query) throw new Error('Evidence workflow query must not be empty.');
  const caller = options.caller ?? callVerb;
  const now = options.now ?? new Date();
  const maxCalls = Math.max(1, Math.min(options.maxCalls ?? 4, 6));
  const runtimeOptions: RunGbrainOptions = {
    stateRoot: options.stateRoot,
    gbrainCli: options.gbrainCli,
  };
  const entity = options.workflow === 'weekly-evolution' ? null : inferredEntity(query, options.entity);

  const envelopes: RecordLike[] = [];
  const attemptedQueries: string[] = [];
  const evidence: EvidenceReference[] = [];

  const run = (verb: string, params: Record<string, unknown>, slot: string, label: string): void => {
    if (envelopes.length >= maxCalls) return;
    const envelope = caller(verb, params, runtimeOptions);
    envelopes.push(envelope);
    attemptedQueries.push(label);
    evidence.push(...evidenceFromEnvelope(envelope, slot, now));
  };

  let since: string | null = null;
  if (options.workflow === 'weekly-evolution') {
    since = normalizedSince(options, now);
    run('delta', { since, budget_tokens: 2600 }, 'delta', `delta:${since}`);
    if (envelopes.length < maxCalls) {
      run('recall', { query, limit: 8, budget_tokens: 1600 }, 'standing-context', query);
    }
  } else {
    run('recall', {
      query,
      ...(entity ? { entity } : {}),
      limit: 8,
      budget_tokens: 1800,
    }, 'primary', query);
    let currentCoverage = coverageFor(dedupeEvidence(evidence));
    for (const slot of RECALL_SLOTS[options.workflow]) {
      if (envelopes.length >= maxCalls) break;
      if (!slot.needed(currentCoverage)) continue;
      const expandedQuery = queryWithSuffix(query, slot.suffix);
      run('recall', {
        query: expandedQuery,
        ...(entity ? { entity } : {}),
        limit: 6,
        budget_tokens: 1200,
      }, slot.name, expandedQuery);
      currentCoverage = coverageFor(dedupeEvidence(evidence));
    }
  }

  const finalEvidence = dedupeEvidence(evidence);
  const coverage = coverageFor(finalEvidence.filter((item) => item.current));
  const droppedCount = envelopes.reduce(
    (sum, envelope) => sum + (typeof envelope.dropped_count === 'number' ? envelope.dropped_count : 0),
    0,
  );
  const degraded = envelopes.some((envelope) => (
    envelope.search_degraded === true
    || typeof envelope.search_degraded === 'string'
    || typeof envelope.degraded_reason === 'string'
  ));
  const hasMore = envelopes.some((envelope) => envelope.has_more === true);

  return {
    workflow: options.workflow,
    query,
    evidence: finalEvidence,
    claims: claimsFromEvidence(finalEvidence),
    unknowns: buildUnknowns(options.workflow, coverage),
    sources: uniqueSources(finalEvidence),
    retrieval: {
      protocol_version: envelopes[0]?.protocol_version ?? null,
      degraded,
      dropped_count: droppedCount,
      attempted_queries: attemptedQueries,
      calls: envelopes.length,
      coverage,
      has_more: hasMore,
      since,
      entity,
    },
  };
}
