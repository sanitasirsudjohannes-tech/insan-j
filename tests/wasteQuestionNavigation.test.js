import test from 'node:test';
import assert from 'node:assert/strict';
import { readDataFilters } from '../src/lib/urlDataFilters.js';
import { buildSourceLink } from '../src/features/waste-chat/presentation/questionPresentation.js';
import { buildAnswerPresentation } from '../src/features/waste-chat/answers/answerPresentation.js';
import { findFuzzyRoomCandidates, resolveKnownRoom } from '../src/features/waste-chat/parsers/roomNameResolver.js';
import { ALLOWED_INTENTS } from '../src/features/waste-chat/constants/wasteQuestionConstants.js';

const period = { start: '2026-09-14', end: '2026-09-14', label: '14 September 2026', scope: 'day' };

test('filter tautan sumber membaca tanggal, bulan, ruangan, jenis, dan tab', () => {
  assert.deepEqual(readDataFilters('?start=2026-09-14&end=2026-09-14&month=2026-09&room=ICU&type=infectiousKg&tab=ruangan'), {
    start: '2026-09-14', end: '2026-09-14', date: '2026-09-14', month: '2026-09',
    room: 'ICU', type: 'infectiousKg', tab: 'ruangan',
  });
});

test('tautan data ruangan membuka tab dan filter yang sesuai', () => {
  const link = buildSourceLink({ intent: 'room_total', period, roomName: 'ICU' });
  assert.match(link.to, /^\/limbah-dihasilkan\?/);
  const query = new URLSearchParams(link.to.split('?')[1]);
  assert.equal(query.get('tab'), 'ruangan');
  assert.equal(query.get('room'), 'ICU');
  assert.equal(query.get('start'), period.start);
  assert.equal(query.get('end'), period.end);
});

test('perbandingan menyediakan tautan untuk kedua periode', () => {
  const previous = { start: '2026-08-01', end: '2026-08-31', label: 'Agustus 2026', scope: 'month' };
  const current = { start: '2026-09-01', end: '2026-09-30', label: 'September 2026', scope: 'month' };
  const recap = { facts: {}, charts: { timeline: [] }, analytics: {} };
  const presentation = buildAnswerPresentation({ intent: 'comparison', period: current, comparisonPeriod: previous, question: 'bandingkan' }, recap, recap);
  assert.equal(presentation.sourceLinks.length, 2);
  assert.match(presentation.sourceLinks[0].to, /month=2026-08/);
  assert.match(presentation.sourceLinks[1].to, /month=2026-09/);
  assert.equal(presentation.sourceLink, null);
});

test('salah ketik ruangan yang ambigu tidak dipilih otomatis', () => {
  const rooms = ['Bugenvil 1', 'Bugenvil 2'];
  assert.deepEqual(findFuzzyRoomCandidates('Timbulan Bugenvl', rooms), rooms);
  assert.equal(resolveKnownRoom('Timbulan Bugenvl', rooms), null);
  assert.equal(resolveKnownRoom('Timbulan Bugenvl 2', rooms), 'Bugenvil 2');
});

test('intent bantuan perhitungan dan pemeriksaan harian diizinkan', () => {
  assert.equal(ALLOWED_INTENTS.has('calculation_help'), true);
  assert.equal(ALLOWED_INTENTS.has('daily_review'), true);
});
