import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGLiteEngine } from '../../../src/core/pglite-engine.ts';
import { hybridSearch } from '../../../src/core/search/hybrid.ts';
import { normalizeAlias } from '../../../src/core/search/alias-normalize.ts';
import { configureGateway } from '../../../src/core/ai/gateway.ts';

type PageFixture = {
  slug: string;
  type: string;
  title: string;
  body: string;
  aliases: string[];
};

type CaseFixture = {
  id: string;
  query: string;
  source_id?: string;
  expect_any?: string[];
  expect_none?: string[];
  expect_empty?: boolean;
};

type Baseline = {
  default_source: string;
  pages: PageFixture[];
  isolated_sources: Array<{ source_id: string; pages: PageFixture[] }>;
  cases: CaseFixture[];
};

const baseline = JSON.parse(
  readFileSync(join(import.meta.dir, '../evals/retrieval-baseline.json'), 'utf8'),
) as Baseline;

let engine: PGLiteEngine;

async function seedPage(page: PageFixture, sourceId: string): Promise<void> {
  await engine.putPage(
    page.slug,
    { type: page.type as never, title: page.title, compiled_truth: page.body },
    { sourceId },
  );
  await engine.upsertChunks(
    page.slug,
    [{ chunk_index: 0, chunk_text: page.body, chunk_source: 'compiled_truth' }],
    { sourceId },
  );
  if (page.aliases.length > 0) {
    await engine.setPageAliases(page.slug, sourceId, page.aliases.map(normalizeAlias));
  }
}

beforeAll(async () => {
  configureGateway({
    embedding_model: 'openai:text-embedding-3-large',
    embedding_dimensions: 1536,
    env: {},
  });
  engine = new PGLiteEngine();
  await engine.connect({});
  await engine.initSchema();

  for (const page of baseline.pages) await seedPage(page, baseline.default_source);
  for (const isolated of baseline.isolated_sources) {
    await engine.executeRaw(
      `INSERT INTO sources (id, name) VALUES ($1, $1) ON CONFLICT DO NOTHING`,
      [isolated.source_id],
    );
    for (const page of isolated.pages) await seedPage(page, isolated.source_id);
  }
});

afterAll(async () => {
  await engine.disconnect();
  configureGateway({
    embedding_model: 'openai:text-embedding-3-large',
    embedding_dimensions: 1536,
    env: { ...process.env },
  });
});

describe('Chinese and bilingual retrieval baseline', () => {
  for (const item of baseline.cases) {
    test(item.id, async () => {
      const hits = await hybridSearch(engine, item.query, {
        limit: 5,
        expansion: false,
        ...(item.source_id ? { sourceId: item.source_id } : {}),
      });
      const slugs = hits.map((hit) => hit.slug);

      for (const expected of item.expect_any ?? []) expect(slugs).toContain(expected);
      for (const excluded of item.expect_none ?? []) expect(slugs).not.toContain(excluded);
      if (item.expect_empty) expect(slugs).toEqual([]);
    });
  }
});
