import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as legacy from '../src/lib/reportAssistant.js';
import { buildLocalReport } from '../src/features/report-assistant/domain/reportBuilder.js';
import { validateReportPayload } from '../src/features/report-assistant/domain/reportValidation.js';
import { REPORT_TYPES } from '../src/features/report-assistant/constants/reportTypes.js';
import { buildDocxBlob } from '../src/features/report-assistant/exporters/docxBuilder.js';
import * as legacyExport from '../src/lib/docxExport.js';

test('jalur impor lama menggunakan implementasi laporan yang sama', () => {
  assert.equal(legacy.buildLocalReport, buildLocalReport);
  assert.equal(legacy.validateReportPayload, validateReportPayload);
  assert.equal(legacy.REPORT_TYPES, REPORT_TYPES);
  assert.equal(legacyExport.buildDocxBlob, buildDocxBlob);
});

test('domain laporan tidak bergantung pada UI, browser, atau database', () => {
  const dir = new URL('../src/features/report-assistant/domain/', import.meta.url);
  for (const name of readdirSync(dir)) {
    const source = readFileSync(new URL(name, dir), 'utf8');
    assert.doesNotMatch(source, /from ['"].*(react|supabase|sweetalert|components|hooks|exporters)/, name);
    assert.doesNotMatch(source, /\b(window|document|sessionStorage|navigator)\./, name);
  }
});

test('renderer grafik tidak memuat pembuat Word', () => {
  const source = readFileSync(new URL('../src/features/report-assistant/exporters/reportChartRenderer.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from ['"]docx['"]/);
});
