import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

test('domain pemeriksaan air bebas dari UI, browser, dan database', () => {
  const dir = new URL('../src/features/pemeriksaan-air/domain/', import.meta.url);
  for (const name of readdirSync(dir)) {
    const source = readFileSync(new URL(name, dir), 'utf8');
    assert.doesNotMatch(source, /from ['"].*(react|supabase|sweetalert|components|hooks|services|presentation)/, name);
    assert.doesNotMatch(source, /\b(window|document|sessionStorage|navigator)\./, name);
  }
});

test('halaman pemeriksaan air hanya menyusun hook dan komponen fitur', () => {
  const source = readFileSync(new URL('../src/pages/PemeriksaanAir.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /waterService|supabase|sweetalert|use(State|Effect|Callback|Memo)/);
  assert.match(source, /useWaterExaminations/);
  assert.match(source, /WaterExaminationForm/);
  assert.match(source, /WaterRecordsSection/);
});
