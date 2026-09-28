import test from 'node:test';
import assert from 'node:assert/strict';
import { isWaterQuestion, parseWaterQuestion } from '../src/features/water-chat/parsers/waterQuestionParser.js';
import { answerWaterQuestion } from '../src/features/water-chat/services/answerWaterQuestion.js';

const index = [
  { water_type: 'clean', sampled_at: '2026-09-21', total: 1 },
  { water_type: 'wastewater', sampled_at: '2026-09-20', total: 2 },
];
const wastewater = [{
  id: 'inlet-1', water_type: 'wastewater', sample_point: 'Inlet', sampled_at: '2026-09-20',
  laboratory: 'Labkes NTT', report_number: '01/LAB/2026',
  parameters: [{ parameter: 'BOD', result: '50', unit: 'mg/L', standard: '<=30', regulation: 'Permen LHK' }],
}];
const cleanWater = Array.from({ length: 18 }, (_, index) => ({
  id: `clean-${index}`, water_type: 'clean', sampled_at: '2026-09-21',
  water_clean_locations: { name: `Bak ${index + 1}` },
  parameters: [
    { parameter: 'Total coliform', result: index === 4 ? '12' : '0', unit: '/100 mL', standard: '<=10' },
    { parameter: 'E. coli', result: '0', unit: '/100 mL', standard: '<=0' },
  ],
}));
const repository = {
  fetchDateIndex: async () => index,
  fetchRecords: async type => type === 'wastewater' ? wastewater : [],
};

test('router mengenali air limbah sebagai pemeriksaan air, bukan limbah medis', () => {
  assert.equal(isWaterQuestion('Tampilkan hasil pemeriksaan air limbah terakhir'), true);
  assert.equal(parseWaterQuestion('Tampilkan hasil pemeriksaan air limbah terakhir').waterType, 'wastewater');
});

test('konteks air tidak mengambil alih pertanyaan limbah medis yang eksplisit', () => {
  assert.equal(isWaterQuestion('Berapa timbulan limbah medis bulan ini?', { domain: 'water', waterType: 'clean' }), false);
});

test('parser mendahulukan maksud khusus walaupun pertanyaan menyebut terakhir', () => {
  assert.equal(parseWaterQuestion('Parameter IPAL yang tidak memenuhi pada pemeriksaan terakhir').intent, 'non_compliant');
  assert.equal(parseWaterQuestion('Bandingkan inlet dan outlet IPAL terakhir').intent, 'inlet_outlet');
  assert.equal(parseWaterQuestion('Apakah data inlet dan outlet IPAL terakhir lengkap?').intent, 'completeness');
});

test('jawaban IPAL terakhir memakai tanggal terbaru dan status baku mutu', async () => {
  const answer = await answerWaterQuestion('Tampilkan hasil pemeriksaan IPAL terakhir', { repository });
  assert.match(answer.text, /20 September 2026/);
  assert.match(answer.text, /BOD: 50 mg\/L/);
  assert.match(answer.text, /Tidak memenuhi/);
  assert.equal(answer.context.domain, 'water');
  assert.equal(answer.context.waterType, 'wastewater');
});

test('kelengkapan IPAL memperingatkan outlet yang belum tersedia', async () => {
  const answer = await answerWaterQuestion('Apakah data inlet dan outlet IPAL terakhir lengkap?', { repository });
  assert.match(answer.text, /belum lengkap/i);
  assert.match(answer.text, /Outlet belum tersedia/i);
});

test('daftar tanggal air bersih tidak mengambil rincian pemeriksaan', async () => {
  let detailsCalled = false;
  const answer = await answerWaterQuestion('Daftar tanggal pemeriksaan air bersih', { repository: {
    fetchDateIndex: async () => index,
    fetchRecords: async () => { detailsCalled = true; return []; },
  } });
  assert.match(answer.text, /21 September 2026/);
  assert.equal(detailsCalled, false);
});

test('hasil air bersih diringkas dan hanya menampilkan lokasi bermasalah', async () => {
  const answer = await answerWaterQuestion('Tampilkan hasil air bersih terakhir', { repository: {
    fetchDateIndex: async () => index,
    fetchRecords: async () => cleanWater,
  } });
  assert.match(answer.text, /18 lokasi diperiksa/);
  assert.match(answer.text, /Bak 5/);
  assert.doesNotMatch(answer.text, /Bak 18 —/);
  assert.equal(answer.actions[0].label, 'Lihat rincian lengkap');
});

test('rincian lengkap air bersih tetap tersedia atas permintaan pengguna', async () => {
  const answer = await answerWaterQuestion('Tampilkan rincian lengkap hasil air bersih tanggal 21 September 2026', { repository: {
    fetchDateIndex: async () => index,
    fetchRecords: async () => cleanWater,
  } });
  assert.match(answer.text, /Bak 1 — Total coliform/);
  assert.match(answer.text, /Bak 18 — E\. coli/);
});
