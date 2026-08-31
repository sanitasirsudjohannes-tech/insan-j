import {
  corsHeaders,
  fetchAllRows,
  getAdminContext,
  getErrorMessage,
  getMaintenanceMode,
  getStatusCode,
  insertAuditLog,
  isUuid,
  jsonResponse,
  operationalTables,
  sha256,
  validatePeriod,
  validateTables,
} from '../_shared/adminArchive.ts';

const HISTORY_LIMIT = 30;

const loadState = async (adminClient: Awaited<ReturnType<typeof getAdminContext>>['adminClient']) => {
  const [maintenanceMode, archivesResult, auditResult] = await Promise.all([
    getMaintenanceMode(adminClient),
    adminClient
      .from('data_archives')
      .select('id, schema_version, period_start, period_end, selected_tables, table_counts, checksum_sha256, file_name, file_size_bytes, status, created_at, verified_at, purged_at, restored_at, last_error')
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT),
    adminClient
      .from('admin_audit_logs')
      .select('id, action, archive_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);

  if (archivesResult.error) throw new Error(`Riwayat arsip gagal dimuat: ${archivesResult.error.message}`);
  if (auditResult.error) throw new Error(`Audit arsip gagal dimuat: ${auditResult.error.message}`);

  return {
    maintenance_mode: maintenanceMode,
    archives: archivesResult.data || [],
    audit_logs: auditResult.data || [],
  };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ success: false, error: 'Metode tidak diizinkan.' }, 405);

  try {
    const { adminClient, userId } = await getAdminContext(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || 'state');

    if (action === 'state') {
      return jsonResponse({ success: true, ...(await loadState(adminClient)) });
    }

    if (action === 'set-maintenance') {
      if (typeof body?.enabled !== 'boolean') {
        return jsonResponse({ success: false, error: 'Status mode pemeliharaan tidak valid.' }, 400);
      }

      const { error } = await adminClient
        .from('app_settings')
        .upsert({ key: 'operational_maintenance_mode', value: body.enabled }, { onConflict: 'key' });
      if (error) throw new Error(`Mode pemeliharaan gagal disimpan: ${error.message}`);

      await insertAuditLog(
        adminClient,
        body.enabled ? 'maintenance_enabled' : 'maintenance_disabled',
        userId,
        { enabled: body.enabled },
      );

      return jsonResponse({ success: true, maintenance_mode: body.enabled });
    }

    if (action === 'preview') {
      const period = validatePeriod(body?.period_start, body?.period_end);
      const tables = validateTables(body?.tables);
      const counts: Record<string, number> = {};

      await Promise.all(tables.map(async (table) => {
        const dateColumn = operationalTables[table].dateColumn;
        const { count, error } = await adminClient
          .from(table)
          .select('id', { count: 'exact', head: true })
          .gte(dateColumn, period.start)
          .lte(dateColumn, period.end);
        if (error) throw new Error(`Jumlah ${operationalTables[table].label} gagal dihitung: ${error.message}`);
        counts[table] = count || 0;
      }));

      return jsonResponse({
        success: true,
        period_start: period.start,
        period_end: period.end,
        table_counts: counts,
        total_rows: Object.values(counts).reduce((total, count) => total + count, 0),
      });
    }

    if (action === 'create') {
      const period = validatePeriod(body?.period_start, body?.period_end);
      const tables = validateTables(body?.tables);
      if (!(await getMaintenanceMode(adminClient))) {
        return jsonResponse({
          success: false,
          error: 'Aktifkan mode pemeliharaan sebelum membuat backup final.',
        }, 409);
      }

      const generatedAt = new Date().toISOString();
      const tableData: Record<string, Record<string, unknown>[]> = {};
      const tableCounts: Record<string, number> = {};
      const tableChecksums: Record<string, string> = {};

      for (const table of tables) {
        const rows = await fetchAllRows(adminClient, table, period.start, period.end);
        const missingId = rows.some(row => row.id === null || row.id === undefined || String(row.id) === '');
        if (missingId) throw new Error(`Tabel ${operationalTables[table].label} memiliki record tanpa ID.`);
        tableData[table] = rows;
        tableCounts[table] = rows.length;
        tableChecksums[table] = await sha256(JSON.stringify(rows));
      }

      const payload = {
        schema_version: 1,
        application: 'INSAN-J',
        generated_at: generatedAt,
        period: { start: period.start, end: period.end },
        selected_tables: tables,
        tables: tableData,
      };
      const checksum = await sha256(JSON.stringify(payload));
      const fileName = `INSAN-J_Backup_${period.start}_sd_${period.end}.zip`;

      const { data: archive, error: archiveError } = await adminClient
        .from('data_archives')
        .insert({
          schema_version: 1,
          period_start: period.start,
          period_end: period.end,
          selected_tables: tables,
          table_counts: tableCounts,
          table_checksums: tableChecksums,
          checksum_sha256: checksum,
          file_name: fileName,
          status: 'created',
          created_by: userId,
        })
        .select('id')
        .single();
      if (archiveError || !archive?.id) {
        throw new Error(`Metadata backup gagal disimpan: ${archiveError?.message || 'ID arsip tidak tersedia.'}`);
      }

      try {
        const archiveItems = tables.flatMap(table => tableData[table].map(row => ({
          archive_id: archive.id,
          table_name: table,
          record_id: String(row.id),
          record_version: row.waktu_input ? String(row.waktu_input) : null,
        })));

        for (let index = 0; index < archiveItems.length; index += 500) {
          const { error } = await adminClient
            .from('data_archive_items')
            .insert(archiveItems.slice(index, index + 500));
          if (error) throw new Error(`Snapshot ID backup gagal disimpan: ${error.message}`);
        }

        await insertAuditLog(
          adminClient,
          'backup_created',
          userId,
          { period, table_counts: tableCounts, checksum_sha256: checksum },
          archive.id,
        );
      } catch (error) {
        await adminClient.from('data_archives').delete().eq('id', archive.id);
        throw error;
      }

      const manifest = {
        archive_id: archive.id,
        schema_version: 1,
        application: 'INSAN-J',
        generated_at: generatedAt,
        period: { start: period.start, end: period.end },
        selected_tables: tables,
        table_counts: tableCounts,
        table_checksums: tableChecksums,
        checksum_sha256: checksum,
        file_name: fileName,
      };

      return jsonResponse({ success: true, manifest, payload });
    }

    if (action === 'verify') {
      const archiveId = String(body?.archive_id || '');
      const checksum = String(body?.checksum_sha256 || '').toLowerCase();
      const fileSize = Number(body?.file_size_bytes);
      if (!isUuid(archiveId) || !/^[0-9a-f]{64}$/.test(checksum)) {
        return jsonResponse({ success: false, error: 'Data verifikasi backup tidak valid.' }, 400);
      }

      const { data: archive, error: readError } = await adminClient
        .from('data_archives')
        .select('id, checksum_sha256, status')
        .eq('id', archiveId)
        .maybeSingle();
      if (readError) throw new Error(`Backup gagal diverifikasi: ${readError.message}`);
      if (!archive) return jsonResponse({ success: false, error: 'Backup tidak ditemukan.' }, 404);
      if (archive.checksum_sha256 !== checksum) {
        return jsonResponse({ success: false, error: 'Checksum file tidak cocok. Jangan gunakan file backup ini.' }, 409);
      }
      if (!['created', 'verified'].includes(archive.status)) {
        return jsonResponse({ success: false, error: 'Status backup tidak dapat diverifikasi ulang.' }, 409);
      }

      const updateData: Record<string, unknown> = {
        status: 'verified',
        verified_by: userId,
        verified_at: new Date().toISOString(),
        last_error: null,
      };
      if (Number.isSafeInteger(fileSize) && fileSize > 0) updateData.file_size_bytes = fileSize;

      const { error: updateError } = await adminClient
        .from('data_archives')
        .update(updateData)
        .eq('id', archiveId);
      if (updateError) throw new Error(`Status verifikasi gagal disimpan: ${updateError.message}`);

      await insertAuditLog(
        adminClient,
        'backup_verified',
        userId,
        { checksum_sha256: checksum, file_size_bytes: updateData.file_size_bytes || null },
        archiveId,
      );

      return jsonResponse({ success: true, archive_id: archiveId, status: 'verified' });
    }

    return jsonResponse({ success: false, error: 'Aksi backup tidak dikenali.' }, 400);
  } catch (error) {
    console.error('admin-backup-data error:', error);
    return jsonResponse({ success: false, error: getErrorMessage(error) }, getStatusCode(error));
  }
});
