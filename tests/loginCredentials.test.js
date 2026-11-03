import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUsernameCandidates,
  getLoginErrorMessage,
  isEmailUsername,
} from '../src/features/login/domain/loginCredentials.js';

test('kandidat username mempertahankan huruf asli dan menyiapkan variasi', () => {
  assert.deepEqual(buildUsernameCandidates(' Eci '), ['Eci', 'eci', 'ECI']);
  assert.deepEqual(buildUsernameCandidates('eci'), ['eci', 'Eci', 'ECI']);
  assert.deepEqual(buildUsernameCandidates('imamsetya'), ['imamsetya', 'Imamsetya', 'IMAMSETYA']);
  assert.deepEqual(buildUsernameCandidates('   '), []);
});

test('username berbentuk email tidak diubah', () => {
  assert.equal(isEmailUsername(' Eci@rs.com '), true);
  assert.equal(isEmailUsername('eci'), false);
  assert.equal(isEmailUsername(''), false);
});

test('pesan login membedakan penyebab umum kegagalan', () => {
  assert.match(getLoginErrorMessage({ code: 'invalid_credentials' }), /username atau password salah/i);
  assert.match(getLoginErrorMessage({ code: 'email_not_confirmed' }), /belum dikonfirmasi/i);
  assert.match(getLoginErrorMessage({ code: 'user_banned' }), /diblokir/i);
  assert.match(getLoginErrorMessage({ code: 'over_request_rate_limit' }), /terlalu banyak percobaan/i);
  assert.match(getLoginErrorMessage({ message: 'Unknown error' }), /login gagal/i);
});

test('kegagalan jaringan tidak disamakan dengan password salah', () => {
  assert.match(getLoginErrorMessage({ code: 'login_lookup_failed' }), /koneksi internet/i);
  assert.match(getLoginErrorMessage({ code: 'login_timeout' }), /koneksi internet/i);
  assert.match(getLoginErrorMessage({ name: 'AuthRetryableFetchError' }), /koneksi internet/i);
  assert.doesNotMatch(getLoginErrorMessage({ code: 'login_timeout' }), /password salah/i);
});
