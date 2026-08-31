import {
  corsHeaders,
  getAdminContext,
  getErrorMessage,
  getMaintenanceMode,
  getStatusCode,
  isUuid,
  jsonResponse,
  operationalTables,
  sha256,
  validatePeriod,
  validateTables,
} from '../_shared/adminArchive.ts';

const MAX_STAGE_ROWS = 200;

const getStagedRows = async (
  adminClient: Awaited<ReturnType<typeof getAdminContext>>['adminClient'],
  sessionId: string,
  table: string,
) => {
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  const pageSize = 500;

  while (true) {
    const { data, error } = await adminClient
      .from('data_restore_rows')
      .select('row_index, row_data')
      .eq('session_id', sessionId)
      .eq('table_name', table)
      .order('row_index', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Staging ${table} gagal diverifikasi: ${error.message}`);
    const batch = data || [];
    rows.push(...batch.map(item => item.row_data as Record<string, unknown>));
    if (batch.length < pageSize) return rows;
    from += batch.length;
  }
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Metode tidak diizinkan.' }, 405);

  try {
    const { adminClient, userId } = await getAdminContext(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || 'start');

    if (action === 'start') {
      const manifest = body?.manifest || {};
      const schemaVersion = Number(manifest.schema_version);
      const checksum = String(manifest.checksum_sha256 || '').toLowerCase();
      if (schemaVersion !== 1 || manifest.application !== 'INSAN-J') {
        return jsonResponse({ success: false, error: 'Versi atau sumber file backup tidak didukung.' }, 400);
      }
      if (!/^[0-9a-f]{64}$/.test(checksum)) {
        return jsonResponse({ success: false, error: 'Checksum backup tidak valid.' }, 400);
      }

      const period = validatePeriod(manifest.period?.start, manifest.period?.end);
      const availableTables = validateTables(manifest.selected_tables);
      const selectedTables = validateTables(body?.selected_tables || availableTables);
      if (selectedTables.some(table => !availableTables.includes(table))) {
        return jsonResponse({ success: false, error: 'Pilihan restore tidak tersedia di dalam backup.' }, 400);
      }

      const expectedCounts: Record<string, number> = {};
      const tableChecksums: Record<string, string> = {};
      for (const table of selectedTables) {
        const count = Number(manifest.table_counts?.[table]);
        const tableChecksum = String(manifest.table_checksums?.[table] || '').toLowerCase();
        if (!Number.isSafeInteger(count) || count < 0 || !/^[0-9a-f]{64}$/.test(tableChecksum)) {
          return jsonResponse({ success: false, error: `Manifest tabel ${table} tidak valid.` }, 400);
        }
        expectedCounts[table] = count;
        tableChecksums[table] = tableChecksum;
      }

      let sourceArchiveId: string | null = null;
      if (isUuid(manifest.archive_id)) {
        const { data: archive, error } = await adminClient
          .from('data_archives')
          .select('id, checksum_sha256, status')
          .eq('id', manifest.archive_id)
          .maybeSingle();
        if (error) throw new Error(`Metadata arsip gagal diperiksa: ${error.message}`);
        if (archive) {
          if (archive.checksum_sha256 !== checksum) {
            return jsonResponse({ success: false, error: 'Checksum file berbeda dari metadata arsip.' }, 409);
          }
          if (!['verified', 'purged', 'restored'].includes(archive.status)) {
            return jsonResponse({ success: false, error: 'Backup lokal belum berstatus terverifikasi.' }, 409);
          }
          sourceArchiveId = archive.id;
        }
      }

      await adminClient
        .from('data_restore_sessions')
        .delete()
        .eq('created_by', userId)
        .lt('expires_at', new Date().toISOString());

      const { data: session, error } = await adminClient
        .from('data_restore_sessions')
        .insert({
          source_archive_id: sourceArchiveId,
          schema_version: schemaVersion,
          checksum_sha256: checksum,
          period_start: period.start,
          period_end: period.end,
          selected_tables: selectedTables,
          expected_counts: expectedCounts,
          table_checksums: tableChecksums,
          created_by: userId,
          status: 'staging',
        })
        .select('id, expires_at')
        .single();
      if (error || !session?.id) {
        throw new Error(`Sesi pemulihan gagal dibuat: ${error?.message || 'ID sesi tidak tersedia.'}`);
      }

      return jsonResponse({
        success: true,
        session_id: session.id,
        expires_at: session.expires_at,
        selected_tables: selectedTables,
      });
    }

    if (action === 'stage') {
      const sessionId = String(body?.session_id || '');
      const table = String(body?.table || '');
      const rows = body?.rows;
      const startIndex = Number(body?.start_index);
      if (!isUuid(sessionId) || !(table in operationalTables)) {
        return jsonResponse({ success: false, error: 'Sesi atau tabel staging tidak valid.' }, 400);
      }
      if (!Array.isArray(rows) || rows.length > MAX_STAGE_ROWS || !Number.isSafeInteger(startIndex) || startIndex < 0) {
        return jsonResponse({ success: false, error: `Setiap staging maksimal ${MAX_STAGE_ROWS} record.` }, 400);
      }

      const { data: session, error: sessionError } = await adminClient
        .from('data_restore_sessions')
        .select('id, created_by, selected_tables, period_start, period_end, status, expires_at')
        .eq('id', sessionId)
        .maybeSingle();
      if (sessionError) throw new Error(`Sesi staging gagal diperiksa: ${sessionError.message}`);
      if (!session || session.created_by !== userId) return jsonResponse({ success: false, error: 'Sesi pemulihan tidak ditemukan.' }, 404);
      if (session.status !== 'staging' || new Date(session.expires_at).getTime() <= Date.now()) {
        return jsonResponse({ success: false, error: 'Sesi pemulihan sudah tidak aktif.' }, 409);
      }
      if (!session.selected_tables.includes(table)) {
        return jsonResponse({ success: false, error: 'Tabel tidak dipilih untuk pemulihan.' }, 400);
      }

      const dateColumn = operationalTables[table as keyof typeof operationalTables].dateColumn;
      const stagingRows = rows.map((row: Record<string, unknown>, index: number) => {
        if (!row || typeof row !== 'object' || row.id === null || row.id === undefined || String(row.id) === '') {
          throw Object.assign(new Error(`Record ${table} tanpa ID tidak dapat dipulihkan.`), { status: 400 });
        }
        const recordDate = String(row[dateColumn] || '');
        if (recordDate < session.period_start || recordDate > session.period_end) {
          throw Object.assign(new Error(`Record ${table} berada di luar periode backup.`), { status: 400 });
        }
        return {
          session_id: sessionId,
          table_name: table,
          record_id: String(row.id),
          row_index: startIndex + index,
          row_data: row,
        };
      });

      if (stagingRows.length > 0) {
        const { error } = await adminClient
          .from('data_restore_rows')
          .upsert(stagingRows, { onConflict: 'session_id,table_name,record_id' });
        if (error) throw new Error(`Staging ${table} gagal: ${error.message}`);
      }

      return jsonResponse({ success: true, staged: stagingRows.length });
    }

    if (action === 'commit') {
      const sessionId = String(body?.session_id || '');
      if (!isUuid(sessionId)) return jsonResponse({ success: false, error: 'Sesi pemulihan tidak valid.' }, 400);
      if (!(await getMaintenanceMode(adminClient))) {
        return jsonResponse({ success: false, error: 'Aktifkan mode pemeliharaan sebelum memulihkan data.' }, 409);
      }

      const { data: session, error: sessionError } = await adminClient
        .from('data_restore_sessions')
        .select('id, created_by, selected_tables, expected_counts, table_checksums, status, expires_at')
        .eq('id', sessionId)
        .maybeSingle();
      if (sessionError) throw new Error(`Sesi pemulihan gagal diperiksa: ${sessionError.message}`);
      if (!session || session.created_by !== userId) return jsonResponse({ success: false, error: 'Sesi pemulihan tidak ditemukan.' }, 404);
      if (session.status !== 'staging' || new Date(session.expires_at).getTime() <= Date.now()) {
        return jsonResponse({ success: false, error: 'Sesi pemulihan sudah tidak aktif.' }, 409);
      }

      for (const table of session.selected_tables) {
        const rows = await getStagedRows(adminClient, sessionId, table);
        const expectedCount = Number(session.expected_counts?.[table] || 0);
        if (rows.length !== expectedCount) {
          return jsonResponse({ success: false, error: `Jumlah record ${table} tidak sesuai manifest.` }, 409);
        }
        const checksum = await sha256(JSON.stringify(rows));
        if (checksum !== session.table_checksums?.[table]) {
          return jsonResponse({ success: false, error: `Checksum tabel ${table} tidak cocok. File mungkin rusak.` }, 409);
        }
      }

      const { data: result, error: restoreError } = await adminClient.rpc('admin_commit_restore', {
        target_session_id: sessionId,
        actor_user_id: userId,
      });
      if (restoreError) {
        await adminClient
          .from('data_restore_sessions')
          .update({ last_error: restoreError.message })
          .eq('id', sessionId);
        throw new Error(`Pemulihan dibatalkan: ${restoreError.message}`);
      }

      return jsonResponse({ success: true, session_id: sessionId, result: result || {} });
    }

    if (action === 'abort') {
      const sessionId = String(body?.session_id || '');
      if (!isUuid(sessionId)) return jsonResponse({ success: false, error: 'Sesi pemulihan tidak valid.' }, 400);
      const { error } = await adminClient
        .from('data_restore_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('created_by', userId)
        .eq('status', 'staging');
      if (error) throw new Error(`Sesi pemulihan gagal dibatalkan: ${error.message}`);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: false, error: 'Aksi pemulihan tidak dikenali.' }, 400);
  } catch (error) {
    console.error('admin-restore-data error:', error);
    return jsonResponse({ success: false, error: getErrorMessage(error) }, getStatusCode(error));
  }
});
