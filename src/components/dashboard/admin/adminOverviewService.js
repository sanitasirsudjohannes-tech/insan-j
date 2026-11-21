import { supabase } from '../../../lib/supabase';
import { fetchDashboardAggregation } from '../../../lib/databaseAggregations';
import { fetchAllSupabaseRows } from '../../../lib/supabasePagination';

async function recentRecords() {
  if (!navigator.onLine) throw new Error('Aktivitas terbaru memerlukan koneksi internet.');
  const sources = [['limbah_ruangan', 'Limbah per ruangan'], ['limbah_anorganik', 'Limbah anorganik']];
  const rows = await Promise.all(sources.map(async ([table, label]) => {
    const { data, error } = await supabase.from(table).select('id, tanggal, ruangan, petugas, waktu_input')
      .order('waktu_input', { ascending: false }).order('id', { ascending: false }).limit(5);
    if (error) throw error;
    return (data || []).map(row => ({ ...row, key: table + row.id, label }));
  }));
  return rows.flat().sort((a, b) => String(b.waktu_input || '').localeCompare(String(a.waktu_input || ''))).slice(0, 5);
}

async function inspectionSummary(month) {
  const response = await fetchDashboardAggregation('dashboard_admin_inspeksi_summary', { requested_month: month });
  if (response.data) return response;
  const [year, number] = month.split('-').map(Number);
  const end = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 10);
  const sources = [['ruang_bangunan', 'Bangunan'], ['limbah_medis', 'Limbah'], ['pemeriksaan_toilet', 'Toilet'], ['pemeriksaan_reservoir', 'Reservoir'], ['pemeriksaan_gizi', 'Gizi']];
  const categories = await Promise.all(sources.map(async ([table, label]) => {
    const rows = await fetchAllSupabaseRows(() => supabase.from(table).select('persen')
      .gte('tanggal_pemeriksaan', month + '-01').lt('tanggal_pemeriksaan', end).order('id'));
    return { label, jumlah: rows.length, total: rows.reduce((sum, row) => sum + (Number(row.persen) || 0), 0) };
  }));
  return { source: 'server', updatedAt: new Date().toISOString(), data: {
    categories, totalInspeksi: categories.reduce((sum, row) => sum + row.jumlah, 0),
    totalPersen: categories.reduce((sum, row) => sum + row.total, 0),
  } };
}

async function latestWater(type) {
  const { data, error } = await supabase.from('water_examinations').select('sampled_at')
    .eq('water_type', type).order('sampled_at', { ascending: false }).limit(1);
  if (error) throw error;
  const date = data?.[0]?.sampled_at;
  if (!date) return { type, date: null, rows: [] };
  const rows = await fetchAllSupabaseRows(() => supabase.from('water_examinations')
    .select('id, sample_point, parameters, water_clean_locations(name)')
    .eq('water_type', type).eq('sampled_at', date).order('id'));
  return { type, date, rows };
}

export async function loadAdminOverview(section, month) {
  if (section === 'inspeksi') return inspectionSummary(month);
  if (section === 'air') {
    if (!navigator.onLine) throw new Error('Hubungkan internet untuk melihat pemeriksaan air terakhir.');
    return { data: await Promise.all(['clean', 'wastewater'].map(latestWater)), source: 'server', updatedAt: new Date().toISOString() };
  }
  const [waste, activity] = await Promise.allSettled([
    fetchDashboardAggregation('dashboard_pengangkutan_summary', { requested_month: month }),
    recentRecords(),
  ]);
  return {
    waste: waste.status === 'fulfilled' ? waste.value : null,
    wasteError: waste.status === 'rejected' ? waste.reason.message : !waste.value.data ? 'Ringkasan limbah belum tersedia. Hubungi pengelola aplikasi.' : '',
    activities: activity.status === 'fulfilled' ? activity.value : [],
    activityError: activity.status === 'rejected' ? 'Aktivitas terbaru belum dapat dimuat. Hubungkan internet dan coba kembali.' : '',
  };
}
