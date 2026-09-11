import test from 'node:test';
import assert from 'node:assert/strict';
import { isHealthRegulationQuestion } from '../src/features/waste-chat/parsers/regulationIntent.js';

test('mengenali pertanyaan regulasi limbah dan kesehatan lingkungan', () => {
  ['Apa peraturan penyimpanan limbah medis rumah sakit?', 'Dasar hukum pengelolaan limbah B3 fasyankes', 'Berapa baku mutu air limbah rumah sakit?', 'Permenkes tentang kesehatan lingkungan rumah sakit', 'Aturan pencahayaan dan kebisingan rumah sakit'].forEach(question => assert.equal(isHealthRegulationQuestion(question), true, question));
});

test('tidak mengalihkan pertanyaan data atau regulasi di luar topik', () => {
  ['Berapa sisa limbah bulan ini?', 'Tanggal berapa pengangkutan terakhir?', 'Apa aturan pajak kendaraan?', 'Siapa presiden Indonesia?'].forEach(question => assert.equal(isHealthRegulationQuestion(question), false, question));
});
