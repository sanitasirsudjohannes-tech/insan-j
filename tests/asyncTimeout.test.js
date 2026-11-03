import test from 'node:test';
import assert from 'node:assert/strict';
import { TimeoutError, withTimeout } from '../src/lib/asyncTimeout.js';

test('withTimeout meneruskan hasil promise yang selesai tepat waktu', async () => {
  await assert.doesNotReject(async () => {
    const value = await withTimeout(Promise.resolve('selesai'), 100);
    assert.equal(value, 'selesai');
  });
});

test('withTimeout menolak dengan TimeoutError ketika batas waktu tercapai', async () => {
  await assert.rejects(
    withTimeout(new Promise(() => {}), 5, { code: 'login_timeout', message: 'Terlalu lama.' }),
    error => error instanceof TimeoutError
      && error.code === 'login_timeout'
      && error.message === 'Terlalu lama.',
  );
});
