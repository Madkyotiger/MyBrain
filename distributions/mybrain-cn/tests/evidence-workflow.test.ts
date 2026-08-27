import { describe, expect, test } from 'bun:test';
import { collectEvidenceWorkflow, type VerbCaller } from '../src/evidence-workflow.ts';
import {
  buildMeetingPrep,
  buildProjectBrief,
  buildWeeklyEvolution,
  recordCorrection,
} from '../src/hero-loops.ts';

type SeenCall = { verb: string; params: Record<string, unknown> };

function workflowCaller(seen: SeenCall[]): VerbCaller {
  return (verb, params) => {
    seen.push({ verb, params });
    if (verb === 'delta') {
      return {
        protocol_version: 1,
        pages: [
          {
            slug: 'decisions/2026-08-25-scope',
            title: '试点范围决定',
            updated_at: '2026-08-25T09:00:00Z',
          },
        ],
        facts: [
          {
            fact_id: 'commitment-1',
            fact: '示例负责人承诺周五提交权限清单。',
            kind: 'commitment',
            provenance: 'meeting/2026-08-25',
            recorded_at: '2026-08-25T10:00:00Z',
          },
          {
            fact_id: 'correction-1',
            fact: '预算口径已纠正为不含媒体采买。',
            kind: 'belief',
            provenance: '用户纠正 2026-08-26',
            recorded_at: '2026-08-26T10:00:00Z',
          },
        ],
        threads: [],
        has_more: false,
      };
    }

    const query = String(params.query ?? '');
    if (query.includes('试点范围决定')) {
      return {
        protocol_version: 1,
        results: [
          {
            slug: 'decisions/2026-08-25-scope',
            title: '试点范围决定',
            chunk: '已决定先在单一业务单元试点。',
            evidence: 'keyword_exact',
          },
        ],
        facts: [],
      };
    }
    if (query.includes('承诺')) {
      return {
        protocol_version: 1,
        facts: [
          {
            fact_id: 'commitment-1',
            fact: '示例负责人承诺周五提交权限清单。',
            kind: 'commitment',
            provenance: 'meeting/2026-08-25',
            recorded_at: '2026-08-25T10:00:00Z',
          },
        ],
        results: [],
      };
    }
    if (query.includes('反转条件')) {
      return {
        protocol_version: 1,
        results: [
          {
            slug: 'decisions/2026-08-25-scope',
            title: '试点范围决定',
            chunk: '已决定先在单一业务单元试点；若数据权限未获批准则暂停。',
            evidence: 'keyword_exact',
          },
        ],
        facts: [],
      };
    }
    if (query.includes('已失效')) {
      return {
        protocol_version: 1,
        results: [
          {
            slug: 'corrections/2026-08-26-budget',
            title: '预算口径纠正',
            chunk: '预算口径已纠正为不含媒体采买。',
            evidence: 'keyword_exact',
            updated_at: '2026-08-26T10:00:00Z',
          },
        ],
        facts: [],
      };
    }
    if (query.includes('决定 风险')) {
      return {
        protocol_version: 1,
        results: [
          {
            slug: 'decisions/2026-08-25-scope',
            title: '试点范围决定',
            chunk: '已决定先在单一业务单元试点。',
            evidence: 'keyword_exact',
          },
          {
            slug: 'signals/2026-08-26-permission-risk',
            title: '权限风险',
            chunk: '数据权限尚未批准，可能影响试点启动。',
            evidence: 'keyword_exact',
          },
        ],
        facts: [],
      };
    }
    return {
      protocol_version: 1,
      results: [
        {
          slug: 'briefs/2026-08-25-beichen',
          title: '北辰项目当前状态',
          chunk: '项目目标是验证单一业务单元试点能否在四周内形成可复用流程。',
          evidence: 'keyword_exact',
        },
      ],
      facts: [],
      dropped_count: 0,
    };
  };
}

describe('MyBrain evidence workflow kernel', () => {
  test('meeting prep fills missing evidence slots and binds every claim', () => {
    const seen: SeenCall[] = [];
    const result = buildMeetingPrep({
      stateRoot: '/tmp/state',
      query: '北辰项目 试点范围 数据权限',
      caller: workflowCaller(seen),
      now: new Date('2026-08-27T00:00:00Z'),
    });

    expect(seen.map((item) => item.verb)).toEqual(['recall', 'recall', 'recall']);
    expect(seen[0].params.entity).toBe('北辰项目');
    expect(result.commitments).toHaveLength(1);
    expect(result.decisions).toHaveLength(1);
    expect(result.changes).toHaveLength(1);
    expect(result.quality.unbound_claims).toBe(0);
    expect(result.claims.every((claim) => claim.evidence_ids.length === 1)).toBe(true);
    expect(result.retrieval.coverage.commitment).toBe(1);
  });

  test('adaptive retrieval stops after one call when primary evidence already covers the workflow', () => {
    const seen: SeenCall[] = [];
    const caller: VerbCaller = (verb, params) => {
      seen.push({ verb, params });
      return {
        protocol_version: 1,
        results: [
          {
            slug: 'briefs/complete',
            title: '完整背景',
            chunk: '项目目标是四周内完成试点。',
          },
          {
            slug: 'decisions/complete',
            title: '范围决定',
            chunk: '已决定先在单一业务单元试点。',
          },
          {
            slug: 'signals/complete',
            title: '权限风险',
            chunk: '数据权限仍可能延迟启动。',
          },
        ],
        facts: [
          {
            fact_id: 'commitment-complete',
            fact: '示例负责人承诺周五提交权限清单。',
            kind: 'commitment',
            provenance: 'meeting/complete',
          },
        ],
      };
    };
    const result = buildMeetingPrep({
      stateRoot: '/tmp/state',
      query: '北辰项目',
      caller,
      now: new Date('2026-08-27T00:00:00Z'),
    });
    expect(seen).toHaveLength(1);
    expect(result.retrieval.calls).toBe(1);
    expect(result.quality.unbound_claims).toBe(0);
  });

  test('classification stays conservative around pending decisions and explanatory negation', () => {
    const caller: VerbCaller = () => ({
      protocol_version: 1,
      results: [
        {
          slug: 'briefs/pending-scope',
          title: 'Decision pending',
          chunk: '是否调整范围尚未决定。',
        },
        {
          slug: 'briefs/comparison',
          title: '方案比较',
          chunk: '项目不是全国推广，而是单一业务单元的方案比较。',
        },
        {
          slug: 'briefs/correction-guide',
          title: '纠正流程说明',
          chunk: '这是纠正流程说明，不代表任何事实已经更正。',
          provenance: 'docs/correction-guide',
        },
        {
          slug: 'briefs/budget-update',
          title: '预算口径更新',
          chunk: '预算口径已纠正为不含媒体采买。',
        },
      ],
      facts: [],
    });
    const result = collectEvidenceWorkflow({
      workflow: 'meeting-prep',
      stateRoot: '/tmp/state',
      query: '试点范围',
      caller,
      maxCalls: 1,
      now: new Date('2026-08-27T00:00:00Z'),
    });

    expect(result.evidence.map((item) => item.kind)).toEqual([
      'context',
      'context',
      'context',
      'correction',
    ]);
  });

  test('meeting-prep-v1 keeps the legacy field shapes and five-item known cap', () => {
    const caller: VerbCaller = () => ({
      protocol_version: 1,
      results: Array.from({ length: 7 }, (_, index) => ({
        slug: `briefs/context-${index}`,
        title: `背景 ${index}`,
        chunk: `已导入背景 ${index}。`,
      })),
      facts: [{
        fact_id: 'commitment-legacy',
        fact: '示例负责人承诺周五交付。',
        kind: 'commitment',
        provenance: 'meetings/example',
      }],
    });
    const result = buildMeetingPrep({
      stateRoot: '/tmp/state',
      query: '示例项目',
      caller,
      now: new Date('2026-08-27T00:00:00Z'),
    });

    expect(result.schema_version).toBe('mybrain-cn-meeting-prep-v1');
    expect(result.known).toHaveLength(5);
    expect(result.known.every((item) => (
      typeof item.title === 'string'
      && typeof item.excerpt === 'string'
      && typeof item.source === 'string'
      && !('fact_id' in item)
    ))).toBe(true);
    expect(result.commitments[0]).toMatchObject({
      fact: '示例负责人承诺周五交付。',
      provenance: 'meetings/example',
    });
    expect(result.retrieval).toMatchObject({
      protocol_version: 1,
      degraded: false,
      dropped_count: 0,
      attempted_queries: expect.any(Array),
    });
  });

  test('meeting prep retains a bounded split-term fallback for strict Chinese keyword paths', () => {
    const seen: string[] = [];
    const caller: VerbCaller = (_verb, params) => {
      const query = String(params.query ?? '');
      seen.push(query);
      if (query === '北辰项目') {
        return {
          protocol_version: 1,
          results: [{
            slug: 'briefs/beichen',
            title: '北辰项目会前材料',
            chunk: '试点范围需要在会议中确认。',
          }],
          facts: [],
        };
      }
      return { protocol_version: 1, results: [], facts: [] };
    };
    const result = buildMeetingPrep({
      stateRoot: '/tmp/state',
      query: '北辰项目 试点范围 数据权限',
      caller,
      now: new Date('2026-08-27T00:00:00Z'),
    });

    expect(seen[0]).toBe('北辰项目 试点范围 数据权限');
    expect(seen).toContain('北辰项目');
    expect(seen.length).toBeLessThanOrEqual(3);
    expect(result.known).toHaveLength(1);
  });

  test('an explicit source pins every verb call without widening private visibility', () => {
    const seen: Array<{ options: Parameters<VerbCaller>[2]; params: Record<string, unknown> }> = [];
    const caller: VerbCaller = (_verb, params, options) => {
      seen.push({ options, params });
      return {
        protocol_version: 1,
        results: [{ slug: 'briefs/scoped', title: '已固定来源', chunk: '当前材料来自已固定 source。' }],
        facts: [{
          fact_id: 'private-commitment',
          fact: '本地私密承诺。',
          kind: 'commitment',
          provenance: 'meetings/private-example',
          visibility: 'private',
        }],
      };
    };
    const result = collectEvidenceWorkflow({
      workflow: 'meeting-prep',
      stateRoot: '/tmp/state',
      sourceId: 'workspace',
      query: '示例项目',
      caller,
      maxCalls: 1,
      now: new Date('2026-08-27T00:00:00Z'),
    });

    expect(seen.every((item) => item.options.sourceId === 'workspace')).toBe(true);
    expect(seen.every((item) => item.params.include_private === undefined)).toBe(true);
    expect(result.retrieval.source_id).toBe('workspace');
    expect(result.retrieval.includes_private).toBe(true);
    expect(result.evidence[0].source_id).toBe('workspace');
    expect(result.evidence.find((item) => item.fact_id === 'private-commitment')?.visibility).toBe('private');
  });

  test('workflow-specific call caps floor fractional overrides', () => {
    const caller: VerbCaller = () => ({ protocol_version: 1, results: [], facts: [], pages: [], threads: [] });
    const fractional = collectEvidenceWorkflow({
      workflow: 'project-brief',
      stateRoot: '/tmp/state',
      query: '示例项目',
      caller,
      maxCalls: 2.9,
    });
    const meeting = collectEvidenceWorkflow({
      workflow: 'meeting-prep',
      stateRoot: '/tmp/state',
      query: '示例项目',
      caller,
      maxCalls: 99,
    });
    const project = collectEvidenceWorkflow({
      workflow: 'project-brief',
      stateRoot: '/tmp/state',
      query: '示例项目',
      caller,
      maxCalls: 99,
    });
    const weekly = collectEvidenceWorkflow({
      workflow: 'weekly-evolution',
      stateRoot: '/tmp/state',
      query: '本周变化',
      caller,
      maxCalls: 99,
    });

    expect(fractional.retrieval.calls).toBe(2);
    expect(meeting.retrieval.calls).toBe(3);
    expect(project.retrieval.calls).toBe(4);
    expect(weekly.retrieval.calls).toBe(2);
  });

  test('project brief and weekly evolution share the grounded evidence contract', () => {
    const projectSeen: SeenCall[] = [];
    const project = buildProjectBrief({
      stateRoot: '/tmp/state',
      query: '北辰项目',
      caller: workflowCaller(projectSeen),
      now: new Date('2026-08-27T00:00:00Z'),
    });
    expect(project.objective).not.toBeNull();
    expect(project.decisions).toHaveLength(1);
    expect(project.commitments).toHaveLength(1);
    expect(project.corrections).toHaveLength(1);
    expect(project.quality.claim_grounding_rate).toBe(1);

    const weeklySeen: SeenCall[] = [];
    const weekly = buildWeeklyEvolution({
      stateRoot: '/tmp/state',
      query: '北辰项目',
      caller: workflowCaller(weeklySeen),
      now: new Date('2026-08-27T00:00:00Z'),
    });
    expect(weeklySeen[0].verb).toBe('delta');
    expect(weekly.since).toBe('2026-08-20T00:00:00.000Z');
    expect(weekly.decisions).toHaveLength(1);
    expect(weekly.commitments).toHaveLength(1);
    expect(weekly.corrections).toHaveLength(1);
    expect(weekly.quality.unbound_claims).toBe(0);
    expect(weekly.claims.some((claim) => claim.text === '试点范围决定')).toBe(false);
  });

  test('empty evidence remains an explicit unknown instead of a fabricated answer', () => {
    const caller: VerbCaller = () => ({ protocol_version: 1, results: [], facts: [] });
    const result = collectEvidenceWorkflow({
      workflow: 'meeting-prep',
      stateRoot: '/tmp/state',
      query: '不存在的项目',
      caller,
      now: new Date('2026-08-27T00:00:00Z'),
    });
    expect(result.claims).toEqual([]);
    expect(result.unknowns).toContain('未找到足够的当前背景材料。');
    expect(result.unknowns).toContain('未找到带负责人或期限的当前承诺。');
  });

  test('title-only delta records stay discovery-only all the way through weekly output', () => {
    const caller: VerbCaller = (verb) => verb === 'delta'
      ? {
        protocol_version: 1,
        pages: [{ slug: 'decisions/title-only', title: '只有标题的变化', updated_at: '2026-08-26T00:00:00Z' }],
        facts: [],
        threads: [],
        has_more: false,
      }
      : { protocol_version: 1, results: [], facts: [] };
    const result = buildWeeklyEvolution({
      stateRoot: '/tmp/state',
      query: '本周变化',
      caller,
      now: new Date('2026-08-27T00:00:00Z'),
    });

    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].claimable).toBe(false);
    expect(result.claims).toEqual([]);
    expect(result.decisions).toEqual([]);
    expect(result.next_move).toContain('不要把空检索解释成没有变化');
  });

  test('degraded, budget-trimmed, and incomplete retrieval remains visible in unknowns', () => {
    const caller: VerbCaller = () => ({
      protocol_version: 1,
      pages: [],
      facts: [],
      threads: [],
      degraded_reason: 'bounded_partial',
      dropped_count: 2,
      has_more: true,
    });
    const result = collectEvidenceWorkflow({
      workflow: 'weekly-evolution',
      stateRoot: '/tmp/state',
      query: '本周判断变化',
      caller,
      maxCalls: 1,
      now: new Date('2026-08-27T00:00:00Z'),
    });
    expect(result.retrieval.degraded).toBe(true);
    expect(result.retrieval.dropped_count).toBe(2);
    expect(result.retrieval.has_more).toBe(true);
    expect(result.unknowns.some((item) => item.includes('检索发生降级'))).toBe(true);
    expect(result.unknowns.some((item) => item.includes('预算截断'))).toBe(true);
    expect(result.unknowns.some((item) => item.includes('未交付的尾部'))).toBe(true);
  });

  test('correction refuses a read-back that returns a different fact id', () => {
    const caller: VerbCaller = (verb) => verb === 'remember'
      ? { protocol_version: 1, id: '42', status: 'superseded' }
      : {
        protocol_version: 1,
        facts: [
          {
            fact_id: '41',
            fact: '北辰项目试点范围已经改为单一业务单元。',
            provenance: '旧记录',
          },
        ],
      };
    expect(() => recordCorrection({
      stateRoot: '/tmp/state',
      fact: '北辰项目试点范围已经改为单一业务单元。',
      provenance: '用户纠正 2026-08-27',
      entity: '北辰项目',
      caller,
    })).toThrow('did not verify');
  });

  test('correction refuses a missing write id or non-exact read-back text', () => {
    const fact = '北辰项目试点范围已经改为单一业务单元。';
    const missingWriteId: VerbCaller = (verb) => verb === 'remember'
      ? { protocol_version: 1, status: 'inserted' }
      : { protocol_version: 1, facts: [{ fact_id: '42', fact }] };
    expect(() => recordCorrection({
      stateRoot: '/tmp/state',
      fact,
      provenance: '用户纠正 2026-08-27',
      caller: missingWriteId,
    })).toThrow('fact id');

    const expandedText: VerbCaller = (verb) => verb === 'remember'
      ? { protocol_version: 1, id: '42', status: 'inserted' }
      : { protocol_version: 1, facts: [{ fact_id: '42', fact: `${fact}补充说明。` }] };
    expect(() => recordCorrection({
      stateRoot: '/tmp/state',
      fact,
      provenance: '用户纠正 2026-08-27',
      caller: expandedText,
    })).toThrow('did not verify');
  });

  test('correction reports success only after a fresh recall verifies it', () => {
    const seen: SeenCall[] = [];
    const caller: VerbCaller = (verb, params) => {
      seen.push({ verb, params });
      if (verb === 'remember') {
        return { protocol_version: 1, id: '42', status: 'superseded' };
      }
      return {
        protocol_version: 1,
        facts: [
          {
            fact_id: '42',
            fact: '北辰项目试点范围已经改为单一业务单元。',
            provenance: '用户纠正 2026-08-27',
          },
        ],
      };
    };
    const result = recordCorrection({
      stateRoot: '/tmp/state',
      fact: '北辰项目试点范围已经改为单一业务单元。',
      provenance: '用户纠正 2026-08-27',
      entity: '北辰项目',
      caller,
    });
    expect(seen.map((item) => item.verb)).toEqual(['remember', 'recall']);
    expect(result.status).toBe('superseded');
    expect(result.verification).toEqual({
      verified: true,
      fact_id: '42',
      provenance: '用户纠正 2026-08-27',
    });
  });
});
