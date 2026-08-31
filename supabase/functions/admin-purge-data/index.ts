import {
  corsHeaders,
  expectedDeleteConfirmation,
  getAdminContext,
  getErrorMessage,
  getMaintenanceMode,
  getStatusCode,
  isUuid,
  jsonResponse,
} from '../_shared/adminArchive.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Metode tidak diizinkan.' }, 405);

  try {
    const { adminClient, userId } = await getAdminContext(request);
    const body = await request.json().catch(() => ({}));
    const archiveId = String(body?.archive_id || '');
    const confirmation = String(body?.confirmation || '').trim();

    if (!isUuid(archiveId)) {
      return jsonResponse({ success: false, error: 'ID arsip tidak valid.' }, 400);
    }
    if (!(await getMaintenanceMode(adminClient))) {
      return jsonResponse({ success: false, error: 'Aktifkan mode pemeliharaan sebelum menghapus data.' }, 409);
    }

    const { data: archive, error: archiveError } = await adminClient
      .from('data_archives')
      .select('id, period_start, period_end, status, table_counts')
      .eq('id', archiveId)
      .maybeSingle();
    if (archiveError) throw new Error(`Arsip gagal diperiksa: ${archiveError.message}`);
    if (!archive) return jsonResponse({ success: false, error: 'Arsip tidak ditemukan.' }, 404);
    if (archive.status !== 'verified') {
      return jsonResponse({ success: false, error: 'Hanya backup terverifikasi yang dapat dihapus datanya.' }, 409);
    }

    const expectedConfirmation = expectedDeleteConfirmation(archive.period_start, archive.period_end);
    if (confirmation !== expectedConfirmation) {
      return jsonResponse({
        success: false,
        error: `Konfirmasi tidak cocok. Ketik persis: ${expectedConfirmation}`,
      }, 400);
    }

    const { data: result, error: purgeError } = await adminClient.rpc('admin_purge_archive', {
      target_archive_id: archiveId,
      actor_user_id: userId,
    });
    if (purgeError) throw new Error(`Penghapusan dibatalkan: ${purgeError.message}`);

    return jsonResponse({
      success: true,
      archive_id: archiveId,
      deleted_counts: result || {},
      total_deleted: Object.values(result || {}).reduce(
        (total: number, value) => total + (Number(value) || 0),
        0,
      ),
    });
  } catch (error) {
    console.error('admin-purge-data error:', error);
    return jsonResponse({ success: false, error: getErrorMessage(error) }, getStatusCode(error));
  }
});
