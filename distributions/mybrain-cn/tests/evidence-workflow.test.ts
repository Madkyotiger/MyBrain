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
            text: '已决定先在单一业务单元试点。',
            updated_at: '2026-08-25T09:00:00Z',
          },
        ],
        facts: [
          {
            fact_id: 'commitment-1',
            fact: '王宁承诺周五提交权限清单。',
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
    if (query.includes('承诺')) {
      return {
        protocol_version: 1,
        facts: [
          {
            fact_id: 'commitment-1',
            fact: '王宁承诺周五提交权限清单。',
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
