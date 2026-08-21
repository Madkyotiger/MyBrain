import { callVerb } from './gbrain-runtime.ts';

export interface LoopOptions {
  stateRoot: string;
  query: string;
  gbrainCli?: string;
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>> : [];
}

export function buildMeetingPrep(options: LoopOptions) {
  const attemptedQueries = [options.query];
  const recalls: Array<Record<string, unknown>> = [
    callVerb('recall', { query: options.query, limit: 8, budget_tokens: 1800 }, {
      stateRoot: options.stateRoot,
      gbrainCli: options.gbrainCli,
    }),
  ];
  let results = asArray(recalls[0].results);
  // Chinese work queries often arrive as several noun phrases separated by
  // spaces. Some keyword paths interpret the whole string too strictly. Keep
  // the original query first, then try at most three explicit terms and merge
  // by slug. This is a bounded overlay fallback, not a silent core rewrite.
  if (results.length === 0) {
    const terms = [...new Set(options.query.split(/\s+/).map((term) => term.trim()).filter((term) => term.length >= 2))].slice(0, 3);
    for (const term of terms) {
      attemptedQueries.push(term);
      recalls.push(callVerb('recall', { query: term, limit: 5, budget_tokens: 900 }, {
        stateRoot: options.stateRoot,
        gbrainCli: options.gbrainCli,
      }));
    }
    const seen = new Set<string>();
    results = recalls.flatMap((item) => asArray(item.results)).filter((item) => {
      const key = String(item.slug ?? `${item.title}:${item.chunk}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  const facts = recalls.flatMap((item) => asArray(item.facts));
  const known = results.slice(0, 5).map((item) => ({
    title: item.title ?? item.slug ?? '未命名材料',
    excerpt: item.chunk ?? item.evidence ?? '',
    source: item.slug ?? item.provenance ?? 'unknown',
  }));
  const commitments = facts
    .filter((item) => item.kind === 'commitment')
    .map((item) => ({ fact: item.fact, provenance: item.provenance }));
  return {
    schema_version: 'mybrain-cn-meeting-prep-v1',
    query: options.query,
    known,
    commitments,
    unknowns: known.length === 0
      ? ['当前 Brain 没有足够材料；不要补完背景，先向用户索要一份明确来源。']
      : ['本输出只代表已导入材料；未导入的飞书、微信或公司资料不在结论范围内。'],
    next_move: known.length === 0
      ? '补一份用户明确选择、权限清楚的会前材料。'
      : '先确认最近变化与未完成承诺，再决定本次会议要推动的一个结果。',
    retrieval: {
      protocol_version: recalls[0].protocol_version,
      degraded: recalls.some((item) => item.search_degraded === true || typeof item.search_degraded === 'string'),
      dropped_count: recalls.reduce((sum, item) => sum + (typeof item.dropped_count === 'number' ? item.dropped_count : 0), 0),
      attempted_queries: attemptedQueries,
    },
  };
}

export function recordCorrection(options: {
  stateRoot: string;
  fact: string;
  provenance: string;
  entity?: string;
  gbrainCli?: string;
}) {
  return callVerb('remember', {
    fact: options.fact,
    provenance: options.provenance,
    entity: options.entity,
    kind: 'belief',
    visibility: 'world',
  }, { stateRoot: options.stateRoot, gbrainCli: options.gbrainCli });
}
