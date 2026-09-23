import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWaterAnalysis, buildWaterConclusion } from '../src/features/report-assistant/domain/waterReportNarrative.js';

test('water analysis calculates compliance from recorded statuses', () => {
  const result = buildWaterAnalysis('clean_water', {
    totalExaminations: 2, totalParameters: 10, nonCompliantParameters: 2, locations: ['A', 'B'],
  });
  assert.match(result, /80%/);
  assert.match(result, /2 berstatus tidak memenuhi/);
});

test('wastewater conclusion reports an all-compliant period', () => {
  const result = buildWaterConclusion('wastewater', { totalExaminations: 2, nonCompliantParameters: 0 });
  assert.match(result, /Seluruh parameter/);
  assert.match(result, /petugas/);
});

test('unassessed water parameters do not become compliant automatically', () => {
  const result = buildWaterConclusion('clean_water', { totalExaminations: 1, nonCompliantParameters: 0, unassessedParameters: 2 });
  assert.match(result, /belum dapat disimpulkan/);
});
