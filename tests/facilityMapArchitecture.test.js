import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

test('domain peta bebas dari UI, database, dan browser API', () => {
  const dir = new URL('../src/features/peta/domain/', import.meta.url);
  for (const name of readdirSync(dir)) {
    const source = readFileSync(new URL(name, dir), 'utf8');
    assert.doesNotMatch(source, /from ['"].*(react|supabase|sweetalert|components|hooks|services|presentation)/, name);
    assert.doesNotMatch(source, /\b(window|document|sessionStorage|navigator)\./, name);
  }
});

test('service peta tidak bergantung pada React atau komponen UI', () => {
  const dir = new URL('../src/features/peta/services/', import.meta.url);
  for (const name of readdirSync(dir)) {
    const source = readFileSync(new URL(name, dir), 'utf8');
    assert.doesNotMatch(source, /from ['"].*(react|sweetalert|components|hooks)/, name);
  }
});

test('halaman peta hanya menyusun layout dan komponen fitur', () => {
  const source = readFileSync(new URL('../src/pages/PetaFasilitas.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /waterService|facilityMapService|supabase|sweetalert|leaflet|use(State|Effect|Callback|Memo)/);
  assert.match(source, /AppLayout/);
  assert.match(source, /FacilityMapScreen/);
});
