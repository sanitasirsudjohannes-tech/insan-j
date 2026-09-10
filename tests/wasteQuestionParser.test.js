import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWasteQuestion } from '../src/lib/wasteQuestionParser.js';

test('pertanyaan sisa dengan bulan angka diterjemahkan menjadi periode penuh', () => {
  const result = parseWasteQuestion('Sisa limbah bulan 7 tahun 2026 berapa?');
  assert.equal(result.intent, 'remaining');
  assert.equal(result.period.start, '2026-07-01');
  assert.equal(result.period.end, '2026-07-31');
});

test('parser mengenali jenis, ruangan, dan perbandingan', () => {
  assert.equal(parseWasteQuestion('Berapa infeksius Agustus 2026?').type.key, 'infectiousKg');
  assert.equal(parseWasteQuestion('Ruangan mana penghasil terbesar Juli 2026?').intent, 'top_rooms');
  assert.equal(parseWasteQuestion('Bandingkan Juli 2026 dengan sebelumnya').intent, 'comparison');
});

test('parser mempertahankan dua bulan yang disebutkan untuk perbandingan langsung', () => {
  const result = parseWasteQuestion('Lakukan perbandingan limbah bulan Februari dan Juli');
  assert.equal(result.intent, 'comparison');
  assert.match(result.comparisonPeriod.start, /^20\d{2}-02-01$/);
  assert.match(result.comparisonPeriod.end, /^20\d{2}-02-28$/);
  assert.match(result.period.start, /^20\d{2}-07-01$/);
  assert.match(result.period.end, /^20\d{2}-07-31$/);
});

test('tahun pada perbandingan dua bulan diterapkan ke kedua periode', () => {
  const result = parseWasteQuestion('Bandingkan Februari dengan Juli 2026');
  assert.equal(result.comparisonPeriod.label, 'Februari 2026');
  assert.equal(result.period.label, 'Juli 2026');
  assert.equal(result.period.inferredYear, false);
});

test('pertanyaan yang hanya menyebut tahun menggunakan satu tahun penuh', () => {
  const result = parseWasteQuestion('Berapa data timbulan limbah tahun 2026?');
  assert.equal(result.intent, 'generated');
  assert.equal(result.period.scope, 'year');
  assert.equal(result.period.month, null);
  assert.equal(result.period.start, '2026-01-01');
  assert.equal(result.period.end, '2026-12-31');
  assert.equal(result.period.label, 'tahun 2026');
});

test('bulan ini tetap menggunakan bulan berjalan meskipun tahun disebutkan', () => {
  const result = parseWasteQuestion('Berapa timbulan bulan ini tahun 2026?');
  assert.equal(result.period.scope, 'month');
  assert.equal(result.period.year, 2026);
  assert.notEqual(result.period.month, null);
});

test('tahun ini diterjemahkan sebagai tahun berjalan penuh', () => {
  const result = parseWasteQuestion('Berapa timbulan limbah tahun ini?');
  assert.equal(result.period.scope, 'year');
  assert.match(result.period.start, /^20\d{2}-01-01$/);
  assert.match(result.period.end, /^20\d{2}-12-31$/);
});

test('pertanyaan per tanggal hanya menggunakan satu hari', () => {
  const result = parseWasteQuestion('Berapa timbulan limbah tanggal 5 September 2026?');
  assert.equal(result.period.scope, 'day');
  assert.equal(result.period.start, '2026-09-05');
  assert.equal(result.period.end, '2026-09-05');
  assert.equal(result.period.label, '5 September 2026');
});

test('tanggal berformat angka dikenali sebagai satu hari', () => {
  const result = parseWasteQuestion('Total limbah per tanggal 05/09/2026');
  assert.equal(result.period.scope, 'day');
  assert.equal(result.period.start, '2026-09-05');
  assert.equal(result.period.end, '2026-09-05');
});

test('singkatan tgl dan pertanggal menggunakan satu hari bulan berjalan', () => {
  assert.equal(parseWasteQuestion('Timbulan limbah tgl 8').period.scope, 'day');
  assert.equal(parseWasteQuestion('Timbulan limbah pertanggal 8').period.scope, 'day');
});

test('rentang tanggal sampai hari ini tidak berubah menjadi rekap bulanan', () => {
  const result = parseWasteQuestion('Timbulan limbah 7 Juli sampai hari ini');
  assert.equal(result.intent, 'generated');
  assert.equal(result.period.scope, 'range');
  assert.match(result.period.start, /^20\d{2}-07-07$/);
  assert.match(result.period.end, /^20\d{2}-\d{2}-\d{2}$/);
});

test('pertanyaan ruangan dan rincian jenis mendukung tanggal tertentu', () => {
  const rooms = parseWasteQuestion('Ruangan apa paling banyak timbulannya tgl 8?');
  const types = parseWasteQuestion('Jumlah limbah berdasarkan jenis tanggal 8');
  assert.equal(rooms.intent, 'top_rooms');
  assert.equal(rooms.period.scope, 'day');
  assert.equal(types.intent, 'type_breakdown');
  assert.equal(types.period.scope, 'day');
});

test('pertanyaan lanjutan memakai konteks periode sebelumnya', () => {
  const previous = parseWasteQuestion('Timbulan tanggal 8 September 2026').period;
  const followUp = parseWasteQuestion('Bagaimana rincian jenis pada tanggal tersebut?', previous);
  assert.equal(followUp.intent, 'type_breakdown');
  assert.equal(followUp.period.start, '2026-09-08');
  assert.equal(followUp.period.end, '2026-09-08');
});

test('parser mengenali pertanyaan analisis tambahan', () => {
  assert.equal(parseWasteQuestion('Tanggal berapa timbulan paling banyak bulan ini?').intent, 'peak_day');
  assert.equal(parseWasteQuestion('Berapa hari ada timbulan bulan ini?').intent, 'active_days');
  assert.equal(parseWasteQuestion('Ruangan dengan timbulan paling sedikit bulan ini?').intent, 'bottom_room');
  assert.equal(parseWasteQuestion('Berapa total limbah yang tersedia untuk dikelola?').intent, 'available_total');
  assert.equal(parseWasteQuestion('Berapa persen cakupan pengangkutan?').intent, 'transport_coverage');
});

test('parser mengenali total dan jenis limbah untuk ruangan tertentu', () => {
  const total = parseWasteQuestion('Berapa timbulan ruangan ICU tanggal 8?');
  const type = parseWasteQuestion('Berapa limbah infeksius ruangan ICU tanggal 8?');
  assert.equal(total.intent, 'room_total');
  assert.equal(total.roomName, 'ICU');
  assert.equal(type.intent, 'room_type_total');
  assert.equal(type.type.key, 'infectiousKg');
});

test('rincian dan data limbah dikenali sebagai ringkasan menyeluruh', () => {
  assert.equal(parseWasteQuestion('Rincian limbah bulan ini').intent, 'waste_summary');
  assert.equal(parseWasteQuestion('Tampilkan data limbah tahun 2026').intent, 'waste_summary');
  assert.equal(parseWasteQuestion('Gambaran limbah minggu ini').intent, 'waste_summary');
});

test('parser memahami kosakata sehari-hari terkait limbah', () => {
  assert.equal(parseWasteQuestion('Berapa hasil timbang limbah hari ini?').intent, 'generated');
  assert.equal(parseWasteQuestion('Berapa limbah yang terkumpul kemarin?').intent, 'generated');
  assert.equal(parseWasteQuestion('Berapa yang sudah dikirim bulan lalu?').intent, 'transported');
  assert.equal(parseWasteQuestion('Apakah limbah yang menumpuk masih banyak?').intent, 'remaining');
  assert.equal(parseWasteQuestion('Rataan timbulan per hari bulan ini').intent, 'average');
  assert.equal(parseWasteQuestion('Jumlah safety box tahun ini').type.key, 'sharpsKg');
});

test('periode relatif menggunakan rentang yang sesuai', () => {
  const yesterday = parseWasteQuestion('Timbulan kemarin').period;
  const week = parseWasteQuestion('Data limbah minggu ini').period;
  const lastSevenDays = parseWasteQuestion('Data limbah 7 hari terakhir').period;
  const lastMonth = parseWasteQuestion('Data limbah bulan lalu').period;
  const lastYear = parseWasteQuestion('Data limbah tahun lalu').period;
  assert.equal(yesterday.scope, 'day');
  assert.ok(['day', 'range'].includes(week.scope));
  assert.equal(lastSevenDays.scope, 'range');
  assert.equal(lastMonth.scope, 'month');
  assert.equal(lastYear.scope, 'year');
});
