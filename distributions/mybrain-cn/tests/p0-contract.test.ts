import { describe, expect, test } from 'bun:test';
import { validateP0 } from '../scripts/validate-p0.ts';

describe('MyBrain CN P0 contract', () => {
  test('all contract, boundary, schema, privacy, and upstream guards pass', () => {
    const receipt = validateP0();
    expect(receipt.status).toBe('pass');
    expect(receipt.required_files).toBe(14);
    expect(receipt.data_classes).toBe(5);
    expect(receipt.eval_cases).toBe(8);
    expect(receipt.schema_pack).toBe('mybrain-cn-executive@0.1.0');
    expect(receipt.p0_gates).toEqual(['P0-01', 'P0-02', 'P0-03', 'P0-04', 'P0-05', 'P0-06']);
    expect(receipt.phase1_blockers).toEqual(['P1-OWNER']);
  });
});
