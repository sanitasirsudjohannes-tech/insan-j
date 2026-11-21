import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWasteQuestion as parse } from '../src/lib/wasteQuestionParser.js';
import { buildWasteDataDiagnostics } from '../src/features/waste-chat/diagnostics/wasteDataDiagnostics.js';
import { buildOperationalAnswer } from '../src/features/waste-chat/answers/operationalAnswers.js';
import { buildGeneratedDifferenceAnswer } from '../src/features/waste-chat/answers/generatedDifferenceAnswer.js';

const examples = [
  ['Siapa petugas yang menginput data hari ini?', 'input_officers'],
  ['Tampilkan jumlah ruangan yang diinput setiap hari selama September', 'room_input_history'],
  ['Pada tanggal berapa jumlah ruangan yang diinput paling sedikit?', 'fewest_room_inputs'],
  ['Berapa hari ICU memiliki catatan bulan ini?', 'room_record_days'],
  ['Tampilkan catatan dengan ruangan, tanggal, jenis, dan berat yang sama', 'exact_duplicates'],
  ['Apakah ada nilai limbah negatif?', 'negative_records'],
  ['Ruangan mana yang mencatat semua jenis limbah nol hari ini?', 'zero_rooms'],
  ['Apakah ada nama ruangan yang tidak sesuai daftar resmi?', 'unknown_rooms'],
  ['Apakah ada catatan tanpa nama petugas?', 'missing_officers'],
  ['Apakah ada data bertanggal setelah hari ini?', 'future_records'],
  ['Apakah ada kenaikan berat yang jauh berbeda dari kebiasaan ruangan tersebut?', 'room_outliers'],
  ['Tanggal berapa perhitungan sisa limbah menjadi negatif?', 'negative_balance_dates'],
  ['Berapa timbulan sejak pengangkutan terakhir sampai hari ini?', 'since_transport'],
  ['Berapa sisa limbah sebelum dan setelah pengangkutan terakhir?', 'transport_balance'],
  ['Berapa rata-rata timbulan per hari yang memiliki catatan?', 'recorded_day_average'],
  ['Tanggal berapa timbulan paling tinggi dan paling rendah?', 'day_extremes'],
  ['Apakah pengangkutan bulan ini lebih besar daripada timbulannya?', 'transport_vs_generated'],
  ['Apakah pengangkutan melebihi sisa awal ditambah timbulan pada periode ini?', 'transport_vs_available'],
  ['Apa saja yang perlu diperiksa dari pencatatan hari ini?', 'data_anomalies'],
  ['Ruangan mana yang menyumbang penurunan terbesar?', 'generated_difference'],
  ['Berapa selisih timbulan jika hanya menghitung ruangan yang tercatat pada kedua tanggal?', 'generated_difference'],
];
for (const [question, expected] of examples) test(question, () => assert.equal(parse(question, null, ['ICU']).intent, expected));

test('lanjutan singkat mempertahankan konteks jenis dan ruangan', () => {
  const context = parse('Timbulan infeksius ICU Agustus 2026', null, ['ICU']);
  assert.equal(parse('Kalau kemarin?', context, ['ICU']).intent, 'room_type_total');
  const previous = parse('Kalau bulan sebelumnya?', context, ['ICU']);
  assert.equal(previous.period.start, '2026-07-01');
  assert.equal(previous.type.key, 'infectiousKg');
  const daily = parse('Rinci per tanggal', context, ['ICU']);
  assert.equal(daily.intent, 'daily_details');
  assert.equal(daily.roomName, 'ICU');
  assert.equal(parse('Tampilkan semua ruangannya', context).allRooms, true);
});

test('diagnostik membedakan catatan identik, nol, dan hari tanpa input', () => {
  const roomRows = [
    { tanggal: '2026-01-01', ruangan: 'ICU', infeksius: 0, petugas: 'A' },
    { tanggal: '2026-01-02', ruangan: 'ICU', infeksius: 10, petugas: 'A' },
    { tanggal: '2026-01-02', ruangan: 'ICU', infeksius: 20, petugas: 'A' },
    { tanggal: '2026-01-02', ruangan: 'ICU', infeksius: 10, petugas: 'B' },
    { tanggal: '2026-01-03', ruangan: 'Tidak resmi', infeksius: -1, petugas: '' },
  ];
  const d = buildWasteDataDiagnostics({ start: '2026-01-01', end: '2026-01-04', roomRows, wasteRows: roomRows, knownRooms: ['ICU'] });
  assert.equal(d.exactDuplicates.length, 1);
  assert.equal(d.exactDuplicates[0].count, 2);
  assert.equal(d.duplicateRoomDates[0].count, 3);
  assert.equal(d.zeroRooms.length, 1);
  assert.equal(d.missingOfficers.length, 1);
  assert.deepEqual(d.unknownRooms, ['Tidak resmi']);
  assert.deepEqual(d.missingDates, ['2026-01-04']);
  assert.equal(d.recordedWasteDays, 3);
});

test('pola ruangan memerlukan lima hari pembanding dan tidak menjumlahkan duplikat sebagai hari berbeda', () => {
  const roomRows = Array.from({ length: 6 }, (_, i) => ({ tanggal: `2026-01-0${i + 1}`, ruangan: 'ICU', infeksius: i === 5 ? 40 : 10 }));
  const d = buildWasteDataDiagnostics({ start: '2026-01-01', end: '2026-01-06', roomRows, wasteRows: roomRows });
  assert.equal(d.roomOutliers.length, 1);
  assert.equal(d.roomOutliers[0].median, 10);
  const tooFew = buildWasteDataDiagnostics({ start: '2026-01-01', end: '2026-01-06', roomRows: roomRows.slice(1) });
  assert.equal(tooFew.roomOutliers.length, 0);
});

test('perbandingan hanya ruangan bersama mengecualikan ruangan baru dan manual', () => {
  const parsed = parse('Berapa selisih timbulan hanya menghitung ruangan yang tercatat pada kedua tanggal 1 dan 2 Januari 2026?', null, ['ICU', 'OK']);
  const before = { facts: { totalGeneratedKg: 999, manualGeneratedKg: 989 }, charts: { roomDetails: [{ name: 'ICU', totalKg: 10 }] } };
  const after = { facts: { totalGeneratedKg: 777, manualGeneratedKg: 657 }, charts: { roomDetails: [{ name: 'ICU', totalKg: 20 }, { name: 'OK', totalKg: 100 }] } };
  const text = buildGeneratedDifferenceAnswer(parsed, after, before);
  assert.match(text, /Selisih: naik 10 kg/);
  assert.doesNotMatch(text, /OK:|989|657/);
});

test('timbulan setelah pengangkutan tidak mengasumsikan urutan transaksi pada hari sama', () => {
  const parsed = parse('Berapa timbulan sejak pengangkutan terakhir Januari 2026?');
  const recap = { diagnostics: {}, facts: {}, charts: { timeline: [{ date: '2026-01-02', transported: 100, generated: 50 }, { date: '2026-01-03', transported: 0, generated: 20 }] } };
  assert.match(buildOperationalAnswer(parsed, recap), /20 kg/);
  assert.match(buildOperationalAnswer(parsed, recap), /urutan waktu.*tidak diketahui/);
});

test('pencarian masa depan memiliki batas periode eksplisit dan melewati hari ini', () => {
  const parsed = parse('Apakah ada data bertanggal setelah hari ini?');
  assert.ok(parsed.period.end > parsed.period.start);
  assert.equal(parsed.period.end, '2099-12-31');
});
