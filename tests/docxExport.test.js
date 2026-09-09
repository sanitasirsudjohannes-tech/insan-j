import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDocxBlob } from '../src/lib/docxExport.js';

test('ekspor menghasilkan paket DOCX dengan signature ZIP yang valid', async () => {
  const blob = await buildDocxBlob('LAPORAN UJI\n\nBAB I\nPENDAHULUAN\nIsi laporan.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.deepEqual(Array.from(bytes.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
  assert.ok(bytes.length > 1000);
});
