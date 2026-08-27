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
  entity_slug: string | null;
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
  next_cursor: { since: string; slug: string } | null;
  since: string | null;
  since_slug: string | null;
  entity: string | null;
  source_id: string | null;
  includes_private: boolean;
  visibility_unknown_count: number;
  freshness_unknown_count: number;
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
  sinceSlug?: string;
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
  // callVerb without --source is scoped by GBrain to the literal default source.
  // Keep source_id null to show the caller did not explicitly pin it, but do not
  // turn a protocol-native delta fact into an untraceable or unusable record.
  const source = firstString(record, ['slug', 'provenance', 'source_id']) ?? sourceId ?? 'default';
  const entitySlug = firstString(record, ['entity_slug', 'entity']);
  const provenance = firstString(record, ['provenance']);
  // Core delta is WORLD-only unless include_private is explicitly requested;
  // this overlay never widens it. Recall page results do not expose page
  // visibility/source_class, so their missing value must stay unknown.
  const visibility = firstString(record, ['visibility']) ?? (slot === 'delta' ? 'world' : null);
  const factId = firstString(record, ['fact_id', 'id']);
  const observedAt = firstString(record, ['updated_at', 'observed_at', 'effective_at', 'created_at', 'recorded_at', 'valid_from', 'date']);
  const freshness = evidenceFreshness(record, now);
  const evidenceId = stableId('ev', [sourceId, factId, entitySlug, source, observedAt, excerpt]);

  return {
    evidence_id: evidenceId,
    record_type: recordType,
    kind: classifyEvidence(record),
    title,
    excerpt,
    source,
    source_id: sourceId,
    entity_slug: entitySlug,
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

function evidenceIdentity(item: EvidenceReference): string {
  const scope = item.source_id ?? 'unresolved';
  if (item.record_type === 'fact') {
    if (item.fact_id) return `fact-id\n${scope}\n${item.fact_id}`;
    return `fact-content\n${scope}\n${item.kind}\n${item.entity_slug ?? ''}\n${item.source}\n${item.observed_at ?? ''}\n${compactText(item.excerpt).toLowerCase()}`;
  }
  if ((item.record_type === 'page' || item.record_type === 'result') && item.source !== 'unknown') {
    return `page\n${scope}\n${item.source}`;
  }
  return `record\n${scope}\n${item.record_type}\n${item.kind}\n${item.entity_slug ?? ''}\n${compactText(item.excerpt).toLowerCase()}`;
}

function evidenceRichness(item: EvidenceReference): number {
  return (item.claimable ? 16 : 0)
    + (item.fact_id ? 8 : 0)
    + (item.provenance ? 4 : 0)
    + (item.source !== 'unknown' ? 4 : 0)
    + (item.visibility ? 2 : 0)
    + (item.entity_slug ? 1 : 0)
    + (item.observed_at ? 1 : 0);
}

function mergeEvidence(left: EvidenceReference, right: EvidenceReference): EvidenceReference {
  const preferred = evidenceRichness(right) > evidenceRichness(left) ? right : left;
  const other = preferred === left ? right : left;
  const querySlots = [...new Set([left.query_slot, right.query_slot].flatMap((slot) => slot.split('+')))];
  return {
    ...preferred,
    source_id: preferred.source_id ?? other.source_id,
    entity_slug: preferred.entity_slug ?? other.entity_slug,
    provenance: preferred.provenance ?? other.provenance,
    visibility: preferred.visibility ?? other.visibility,
    fact_id: preferred.fact_id ?? other.fact_id,
    observed_at: preferred.observed_at ?? other.observed_at,
    freshness: preferred.freshness !== 'unknown' ? preferred.freshness : other.freshness,
    current: preferred.current && other.current,
    claimable: preferred.claimable || other.claimable,
    match_reason: preferred.match_reason ?? other.match_reason,
    query_slot: querySlots.join('+'),
  };
}

function dedupeEvidence(items: EvidenceReference[]): EvidenceReference[] {
  const deduped: EvidenceReference[] = [];
  const indexByIdentity = new Map<string, number>();
  const indexById = new Map<string, number>();
  const indexByDeltaFact = new Map<string, number>();
  for (const item of items) {
    const identity = evidenceIdentity(item);
    const deltaFactKey = item.record_type === 'fact' ? factMembershipKey(item) : null;
    const existingIndex = indexById.get(item.evidence_id)
      ?? indexByIdentity.get(identity)
      ?? (deltaFactKey !== null && item.query_slot === 'standing-context'
        ? indexByDeltaFact.get(deltaFactKey)
        : undefined);
    if (existingIndex === undefined) {
      const index = deduped.push(item) - 1;
      indexByIdentity.set(identity, index);
      indexById.set(item.evidence_id, index);
      if (deltaFactKey !== null && item.query_slot === 'delta') indexByDeltaFact.set(deltaFactKey, index);
      continue;
    }
    const merged = mergeEvidence(deduped[existingIndex], item);
    deduped[existingIndex] = merged;
    indexByIdentity.set(evidenceIdentity(merged), existingIndex);
    indexById.set(merged.evidence_id, existingIndex);
  }
  return deduped;
}

function factMembershipKey(item: EvidenceReference): string {
  return `${item.kind}\n${item.entity_slug ?? ''}\n${item.observed_at ?? ''}\n${compactText(item.excerpt).toLowerCase()}`;
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

function normalizedSinceSlug(options: EvidenceWorkflowOptions): string | null {
  if (!options.sinceSlug?.trim()) return null;
  if (!options.since?.trim()) throw new Error('--since-slug requires an explicit --since cursor.');
  const value = options.sinceSlug.trim();
  if (value.length > 512 || value.includes('\0')) throw new Error('Invalid --since-slug cursor.');
  return value;
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

  const run = (
    verb: string,
    params: Record<string, unknown>,
    slot: string,
    label: string,
    accept?: (item: EvidenceReference) => boolean,
  ): void => {
    if (envelopes.length >= maxCalls) return;
    const envelope = caller(verb, params, runtimeOptions);
    envelopes.push(envelope);
    attemptedQueries.push(label);
    const found = evidenceFromEnvelope(envelope, slot, now, sourceId);
    evidence.push(...(accept ? found.filter(accept) : found));
  };

  let since: string | null = null;
  let sinceSlug: string | null = null;
  if (options.workflow === 'weekly-evolution') {
    since = normalizedSince(options, now);
    sinceSlug = normalizedSinceSlug(options);
    run('delta', {
      since,
      ...(sinceSlug ? { since_slug: sinceSlug } : {}),
      budget_tokens: 2600,
    }, 'delta', `delta:${since}${sinceSlug ? `:${sinceSlug}` : ''}`);
    if (envelopes.length < maxCalls) {
      const deltaEvidence = evidence.filter((item) => item.query_slot === 'delta');
      const changedPageSources = new Set(deltaEvidence
        .filter((item) => item.record_type === 'page' && item.source !== 'unknown')
        .map((item) => item.source));
      const deltaFactKeys = new Set(deltaEvidence
        .filter((item) => item.record_type === 'fact')
        .map(factMembershipKey));
      const changedPages = asRecordArray(envelopes[0]?.pages)
        .map((page) => firstString(page, ['title', 'slug']))
        .filter((value): value is string => value !== null)
        .slice(0, 3);
      const standingQuery = changedPages.length > 0
        ? queryWithSuffix(query, changedPages.join(' '))
        : query;
      if (changedPageSources.size > 0 || deltaFactKeys.size > 0) {
        run(
          'recall',
          { query: standingQuery, limit: 8, budget_tokens: 1600 },
          'standing-context',
          standingQuery,
          (item) => {
            if (item.record_type === 'result' || item.record_type === 'page') {
              return changedPageSources.has(item.source);
            }
            if (item.record_type === 'fact') return deltaFactKeys.has(factMembershipKey(item));
            return false;
          },
        );
      }
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
  const cursorRecord = isRecord(envelopes[0]?.next_cursor) ? envelopes[0].next_cursor : null;
  const nextCursor = cursorRecord
    && typeof cursorRecord.since === 'string'
    && typeof cursorRecord.slug === 'string'
    ? { since: cursorRecord.since, slug: cursorRecord.slug }
    : null;
  const unknowns = buildUnknowns(options.workflow, coverage);
  const visibilityUnknownCount = finalEvidence.filter((item) => item.claimable && item.visibility === null).length;
  const freshnessUnknownCount = finalEvidence.filter((item) => item.claimable && item.freshness === 'unknown').length;
  if (degraded) unknowns.push('检索发生降级；当前证据可能不完整，结论不能视为穷尽。');
  if (droppedCount > 0) unknowns.push(`证据预算截断了 ${droppedCount} 条候选；需要扩大预算或缩小问题范围。`);
  if (hasMore) unknowns.push('变化结果仍有未交付的尾部；使用 next_cursor 续读后才能判断完整性。');
  if (hasMore && !nextCursor) unknowns.push('检索声明仍有尾部，但没有返回可用的 next_cursor；当前调用无法安全续读。');
  if (visibilityUnknownCount > 0) {
    unknowns.push(`${visibilityUnknownCount} 条证据的可见性无法由 recall 合同确认；按可能私密处理，勿直接外发。`);
  }
  if (freshnessUnknownCount > 0) {
    unknowns.push(`${freshnessUnknownCount} 条证据缺少可验证的时间锚点；“未发现失效”不等于“已证明仍然有效”。`);
  }

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
      next_cursor: nextCursor,
      since,
      since_slug: sinceSlug,
      entity,
      source_id: sourceId,
      // Unknown visibility is conservative: false is reserved for evidence
      // proven world-only. Downstream callers can inspect the unknown count.
      includes_private: finalEvidence.some((item) => item.visibility === 'private') || visibilityUnknownCount > 0,
      visibility_unknown_count: visibilityUnknownCount,
      freshness_unknown_count: freshnessUnknownCount,
    },
  };
}
