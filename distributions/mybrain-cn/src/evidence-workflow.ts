import { createHash } from 'node:crypto';
import { safeId } from './common.ts';
import { callVerb, type CallVerbOptions } from './gbrain-runtime.ts';

export type EvidenceWorkflowName = 'meeting-prep' | 'project-brief' | 'weekly-evolution';
export type EvidenceKind = 'context' | 'commitment' | 'decision' | 'correction' | 'signal';
export type EvidenceFreshness = 'current' | 'possibly_stale' | 'superseded' | 'unknown';
export type EvidenceRecordType = 'result' | 'page' | 'fact' | 'thread';

export type VerbCaller = (
  verb: string,
  params: Record<string, unknown>,
  options: CallVerbOptions,
) => Record<string, unknown>;

export interface EvidenceReference {
  evidence_id: string;
  record_type: EvidenceRecordType;
  kind: EvidenceKind;
  title: string;
  excerpt: string;
  source: string;
  source_id: string | null;
  provenance: string | null;
  visibility: string | null;
  fact_id: string | null;
  observed_at: string | null;
  freshness: EvidenceFreshness;
  current: boolean;
  claimable: boolean;
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
  source_id: string | null;
  includes_private: boolean;
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
  sourceId?: string;
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

const WORKFLOW_MAX_CALLS: Record<EvidenceWorkflowName, number> = {
  'meeting-prep': 3,
  'project-brief': 4,
  'weekly-evolution': 2,
};

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
  const text = firstString(record, ['fact', 'text', 'chunk', 'summary', 'title'])?.toLowerCase() ?? '';

  if (kind === 'commitment' || slug.startsWith('commitments/')) return 'commitment';
  if (kind === 'decision' || slug.startsWith('decisions/')) return 'decision';
  if (kind === 'signal' || slug.startsWith('signals/')) return 'signal';
  const explicitCorrectionProvenance = (
    /(?:^|[\s:/_-])(?:user|human|operator)[\s_-]*correction(?:$|[\s:/_-])/i.test(provenance)
    || /(?:^|[\s:/_-])用户(?:明确)?纠正(?:$|[\s:/_-])/i.test(provenance)
  );
  const explicitCorrectionText = (
    /(?:已|已经|现已|现在)(?:被)?(?:纠正|更正|修正)(?:为|成|：|:)/i.test(text)
    || /(?:已|已经|现已|现在)(?:被)?改为/i.test(text)
    || /(?:纠正|更正|修正)(?:为|成|：|:)/i.test(text)
    || /(?:原先|原本|此前|之前).{0,40}(?:现(?:已)?改为|现在改为|不再)/i.test(text)
    || /\b(?:corrected|revised)\s+(?:to|as)\b/i.test(text)
  );
  if (
    kind === 'correction'
    || slug.startsWith('corrections/')
    || explicitCorrectionProvenance
    || explicitCorrectionText
  ) return 'correction';
  if (/(?:已|已经|最终|正式)(?:确认)?决定|\b(?:we\s+)?decided\b/i.test(text)) return 'decision';
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
  if (firstString(record, ['updated_at', 'observed_at', 'effective_at', 'created_at', 'recorded_at', 'valid_from', 'date'])) {
    return 'current';
  }
  return 'unknown';
}

function normalizeEvidence(
  record: RecordLike,
  slot: string,
  now: Date,
  sourceId: string | null,
  recordType: EvidenceRecordType,
): EvidenceReference | null {
  const substantive = firstString(record, ['chunk', 'fact', 'text', 'summary']);
  const excerpt = compactText(substantive ?? firstString(record, ['title']) ?? '');
  if (!excerpt) return null;
  const title = compactText(firstString(record, ['title', 'entity_title', 'slug', 'fact']) ?? '未命名证据');
  const source = firstString(record, ['slug', 'provenance', 'source_id']) ?? 'unknown';
  const provenance = firstString(record, ['provenance']);
  const visibility = firstString(record, ['visibility']);
  const factId = firstString(record, ['fact_id', 'id']);
  const observedAt = firstString(record, ['updated_at', 'observed_at', 'effective_at', 'created_at', 'recorded_at', 'valid_from', 'date']);
  const freshness = evidenceFreshness(record, now);
  const evidenceId = stableId('ev', [sourceId, factId, source, excerpt]);

  return {
    evidence_id: evidenceId,
    record_type: recordType,
    kind: classifyEvidence(record),
    title,
    excerpt,
    source,
    source_id: sourceId,
    provenance,
    visibility,
    fact_id: factId,
    observed_at: observedAt,
    freshness,
    current: freshness !== 'superseded' && freshness !== 'possibly_stale',
    claimable: substantive !== null,
    match_reason: firstString(record, ['evidence', 'match_reason']),
    query_slot: slot,
  };
}

function evidenceFromEnvelope(
  envelope: RecordLike,
  slot: string,
  now: Date,
  sourceId: string | null,
): EvidenceReference[] {
  const records: Array<{ record: RecordLike; type: EvidenceRecordType }> = [
    ...asRecordArray(envelope.results).map((record) => ({ record, type: 'result' as const })),
    ...asRecordArray(envelope.pages).map((record) => ({ record, type: 'page' as const })),
    ...asRecordArray(envelope.facts).map((record) => ({ record, type: 'fact' as const })),
    ...asRecordArray(envelope.threads).map((record) => ({ record, type: 'thread' as const })),
  ];
  return records
    .map(({ record, type }) => normalizeEvidence(record, slot, now, sourceId, type))
    .filter((item): item is EvidenceReference => item !== null);
}

function dedupeEvidence(items: EvidenceReference[]): EvidenceReference[] {
  const byId = new Map<string, EvidenceReference>();
  const byContent = new Set<string>();
  for (const item of items) {
    const contentKey = `${item.source_id ?? 'unresolved'}\n${item.kind}\n${item.source}\n${item.excerpt}`;
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
    .filter((item) => item.current && item.claimable)
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
  const hardMaxCalls = WORKFLOW_MAX_CALLS[options.workflow];
  const requestedMaxCalls = typeof options.maxCalls === 'number' && Number.isFinite(options.maxCalls)
    ? Math.floor(options.maxCalls)
    : hardMaxCalls;
  const maxCalls = Math.max(1, Math.min(requestedMaxCalls, hardMaxCalls));
  const sourceId = options.sourceId ? safeId(options.sourceId, 'source id') : null;
  const runtimeOptions: CallVerbOptions = {
    stateRoot: options.stateRoot,
    gbrainCli: options.gbrainCli,
    sourceId: sourceId ?? undefined,
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
    evidence.push(...evidenceFromEnvelope(envelope, slot, now, sourceId));
  };

  let since: string | null = null;
  if (options.workflow === 'weekly-evolution') {
    since = normalizedSince(options, now);
    run('delta', { since, budget_tokens: 2600 }, 'delta', `delta:${since}`);
    if (envelopes.length < maxCalls) {
      const changedPages = asRecordArray(envelopes[0]?.pages)
        .map((page) => firstString(page, ['title', 'slug']))
        .filter((value): value is string => value !== null)
        .slice(0, 3);
      const standingQuery = changedPages.length > 0
        ? queryWithSuffix(query, changedPages.join(' '))
        : query;
      run('recall', { query: standingQuery, limit: 8, budget_tokens: 1600 }, 'standing-context', standingQuery);
    }
  } else {
    run('recall', {
      query,
      ...(entity ? { entity } : {}),
      limit: 8,
      budget_tokens: 1800,
    }, 'primary', query);
    let currentCoverage = coverageFor(dedupeEvidence(evidence).filter((item) => item.current && item.claimable));
    if (options.workflow === 'meeting-prep') {
      const hasKnownContext = dedupeEvidence(evidence).some((item) => (
        item.record_type === 'result' && item.current && item.claimable
      ));
      if (!hasKnownContext) {
        const terms = [...new Set(query.split(/\s+/).map((term) => term.trim()).filter((term) => term.length >= 2))];
        for (const term of terms) {
          if (envelopes.length >= maxCalls) break;
          run('recall', {
            query: term,
            ...(entity ? { entity } : {}),
            limit: 5,
            budget_tokens: 900,
          }, 'term-fallback', term);
          if (dedupeEvidence(evidence).some((item) => (
            item.record_type === 'result' && item.current && item.claimable
          ))) break;
        }
        currentCoverage = coverageFor(dedupeEvidence(evidence).filter((item) => item.current && item.claimable));
      }
    }
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
      currentCoverage = coverageFor(dedupeEvidence(evidence).filter((item) => item.current && item.claimable));
    }
  }

  const finalEvidence = dedupeEvidence(evidence);
  const coverage = coverageFor(finalEvidence.filter((item) => item.current && item.claimable));
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
  const unknowns = buildUnknowns(options.workflow, coverage);
  if (degraded) unknowns.push('检索发生降级；当前证据可能不完整，结论不能视为穷尽。');
  if (droppedCount > 0) unknowns.push(`证据预算截断了 ${droppedCount} 条候选；需要扩大预算或缩小问题范围。`);
  if (hasMore) unknowns.push('变化结果仍有未交付的尾部；继续读取下一游标后才能判断完整性。');

  return {
    workflow: options.workflow,
    query,
    evidence: finalEvidence,
    claims: claimsFromEvidence(finalEvidence),
    unknowns,
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
      source_id: sourceId,
      includes_private: finalEvidence.some((item) => item.visibility === 'private'),
    },
  };
}
