import { supabase } from '../../../lib/supabase';
import { calculateParameterStatus } from '../../pemeriksaan-air/waterHelpers.js';

const formatDate = value => {
  if (!value) return '-';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })
    .format(new Date(Date.UTC(year, month - 1, day)));
};

const parameterText = parameters => (parameters || [])
  .map(item => `${item.parameter}: ${item.result}${item.unit ? ` ${item.unit}` : ''}${item.standard ? ` (baku mutu ${item.standard}${item.regulation ? `; rujukan ${item.regulation}` : ''})` : ''}`)
  .join('; ');

const recordLine = record => {
  const location = record.water_type === 'clean' ? record.water_clean_locations?.name : record.sample_point;
  return `${formatDate(record.sampled_at)} — ${location || '-'}: ${parameterText(record.parameters) || 'parameter tidak tersedia'}`;
};

const nonCompliantItems = records => records.flatMap(record => {
  const location = record.water_type === 'clean' ? record.water_clean_locations?.name : record.sample_point;
  return (record.parameters || [])
    .filter(item => item.status === 'tidak_memenuhi')
    .map(item => ({
      date: record.sampled_at,
      location: location || '-',
      parameter: item.parameter,
      result: item.result,
      unit: item.unit || '',
      standard: item.standard || '',
    }));
});

export async function fetchWaterReportRecap(start, end, reportType) {
  if (!['clean_water', 'wastewater'].includes(reportType)) throw new Error('Jenis laporan air tidak valid.');
  const waterType = reportType === 'clean_water' ? 'clean' : 'wastewater';
  const records = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('water_examinations')
      .select('id, water_type, sample_point, sampled_at, resulted_at, laboratory, report_number, parameters, notes, water_clean_locations(name)')
      .eq('water_type', waterType)
      .gte('sampled_at', start)
      .lte('sampled_at', end)
      .order('sampled_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    records.push(...(data || []).map(record => ({
      ...record,
      parameters: (record.parameters || []).map(item => ({
        ...item,
        parameter: record.water_type === 'clean' && /^coliform$/i.test(String(item.parameter).trim()) ? 'Total coliform' : item.parameter,
        status: calculateParameterStatus(item.result, item.standard),
      })),
    })));
    if (!data || data.length < pageSize) break;
  }
  const nonCompliant = nonCompliantItems(records);
  const locations = [...new Set(records.map(record => waterType === 'clean' ? record.water_clean_locations?.name : record.sample_point).filter(Boolean))];
  const common = {
    totalExaminations: records.length,
    totalParameters: records.reduce((total, record) => total + (record.parameters?.length || 0), 0),
    compliantParameters: records.reduce((total, record) => total + (record.parameters || []).filter(item => item.status !== 'tidak_memenuhi').length, 0),
    nonCompliantParameters: nonCompliant.length,
    unassessedParameters: records.reduce((total, record) => total + (record.parameters || []).filter(item => !['memenuhi', 'tidak_memenuhi'].includes(item.status)).length, 0),
    locations,
    records,
    nonCompliant,
  };

  if (waterType === 'wastewater') {
    const inlet = records.filter(record => record.sample_point === 'Inlet');
    const outlet = records.filter(record => record.sample_point === 'Outlet');
    return {
      facts: {
        samplingLocation: locations.join(', ') || 'Tidak ada data pemeriksaan',
        inletResult: inlet.map(recordLine).join('\n') || 'Tidak ada data inlet pada periode ini.',
        outletResult: outlet.map(recordLine).join('\n') || 'Tidak ada data outlet pada periode ini.',
        compliance: nonCompliant.length
          ? `${nonCompliant.length} parameter tidak memenuhi baku mutu: ${nonCompliant.map(item => `${item.parameter} di ${item.location} (${item.result}${item.unit ? ` ${item.unit}` : ''})`).join('; ')}.`
          : common.unassessedParameters ? `${common.unassessedParameters} parameter belum dinilai.` : 'Seluruh parameter dengan hasil dan baku mutu numerik berstatus memenuhi; verifikasi terhadap laporan lab tetap diperlukan.',
      },
      analytics: { ...common, inletCount: inlet.length, outletCount: outlet.length },
    };
  }

  return {
    facts: {
      samplingLocation: locations.join(', ') || 'Tidak ada data pemeriksaan',
      parameterResults: records.map(recordLine).join('\n') || 'Tidak ada data air bersih pada periode ini.',
      problemParameters: nonCompliant.length
        ? nonCompliant.map(item => `${formatDate(item.date)} — ${item.location}: ${item.parameter} ${item.result}${item.unit ? ` ${item.unit}` : ''}${item.standard ? `; baku mutu ${item.standard}` : ''}`).join('\n')
        : common.unassessedParameters ? `${common.unassessedParameters} parameter belum dinilai.` : 'Tidak terdapat parameter yang ditandai tidak memenuhi baku mutu; verifikasi hasil lab tetap diperlukan.',
      evaluation: records.length
        ? `Terdapat ${records.length} pemeriksaan pada ${locations.length} lokasi dengan ${common.totalParameters} hasil parameter. ${nonCompliant.length} parameter memerlukan tindak lanjut.`
        : 'Belum ada data yang dapat dievaluasi pada periode ini.',
    },
    analytics: common,
  };
}

