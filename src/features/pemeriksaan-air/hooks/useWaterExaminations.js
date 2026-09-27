import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { getCurrentUser } from '../../../lib/api';
import {
  deleteWaterExamination,
  getCleanWaterLocations,
  getWaterExaminations,
  getWaterStandards,
  saveWaterExamination,
} from '../waterService';
import {
  CLEAN_WATER_PARAMETERS,
  calculateParameterStatus,
  parameterFromStandard,
  toCleanWaterParameters,
  validateExamination,
} from '../waterHelpers';
import {
  createParametersFromStandards,
  createWaterForm,
  currentWaterMonth,
  standardsForType,
  summarizeWaterRecords,
} from '../domain/waterFormModel';
import { waterErrorMessage } from '../presentation/waterMessages';

const withCurrentStandards = (parameters, standards, waterType) => parameters.map(item => {
  if (item.standard_id && item.regulation) return item;
  const standard = standardsForType(standards, waterType).find(entry => entry.parameter === item.parameter);
  return standard ? parameterFromStandard(standard, item.result) : item;
});

export function useWaterExaminations() {
  const user = getCurrentUser();
  const [form, setForm] = useState(createWaterForm());
  const [locations, setLocations] = useState([]);
  const [standards, setStandards] = useState([]);
  const [records, setRecords] = useState([]);
  const [month, setMonth] = useState(currentWaterMonth());
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [tableGenerated, setTableGenerated] = useState(false);
  const [cleanRows, setCleanRows] = useState([]);
  const [wastewaterRows, setWastewaterRows] = useState([]);

  const parametersFor = useCallback(
    waterType => createParametersFromStandards(standards, waterType),
    [standards],
  );

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await getWaterExaminations({ month, waterType: typeFilter }));
    } catch (error) {
      Swal.fire('Data Tidak Dapat Dimuat', waterErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [month, typeFilter]);

  useEffect(() => {
    Promise.all([getCleanWaterLocations(), getWaterStandards()])
      .then(([nextLocations, nextStandards]) => {
        setLocations(nextLocations);
        setStandards(nextStandards);
      })
      .catch(error => Swal.fire('Data Tidak Dapat Dimuat', waterErrorMessage(error), 'error'));
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const totals = useMemo(() => summarizeWaterRecords(records), [records]);

  const resetGeneratedTable = () => {
    setTableGenerated(false);
    setCleanRows([]);
    setWastewaterRows([]);
  };

  const changeField = (field, value) => {
    if (field === 'water_type') resetGeneratedTable();
    setForm(current => field === 'water_type'
      ? { ...current, water_type: value, clean_water_location_id: '', sample_point: 'Inlet', parameters: parametersFor(value) }
      : { ...current, [field]: value });
  };

  const openNew = waterType => {
    const available = standardsForType(standards, waterType);
    if (waterType === 'clean' && CLEAN_WATER_PARAMETERS.some(name => !available.some(item => item.parameter === name))) {
      Swal.fire('Baku Mutu Belum Lengkap', 'Admin perlu mengatur Total coliform dan E. coli beserta rujukannya.', 'warning');
      return;
    }
    if (waterType === 'wastewater' && !available.length) {
      Swal.fire('Baku Mutu Belum Tersedia', 'Admin perlu menambah parameter dan rujukan air limbah terlebih dahulu.', 'warning');
      return;
    }
    setForm({ ...createWaterForm(waterType), parameters: parametersFor(waterType) });
    resetGeneratedTable();
    setShowForm(true);
  };

  const generateTable = () => {
    if (!form.sampled_at) {
      Swal.fire('Data Belum Lengkap', 'Tanggal sampling wajib diisi sebelum membuat tabel.', 'warning');
      return;
    }
    if (form.water_type === 'clean') {
      if (!locations.length) {
        Swal.fire('Lokasi Belum Tersedia', 'Admin perlu menambahkan lokasi/bak air bersih terlebih dahulu.', 'warning');
        return;
      }
      setCleanRows(current => locations.map(location => current.find(row => row.locationId === location.id) || ({
        locationId: location.id,
        locationName: location.name,
        parameters: parametersFor('clean'),
      })));
    } else {
      const parameters = parametersFor('wastewater');
      if (!parameters.length) {
        Swal.fire('Baku Mutu Belum Tersedia', 'Admin perlu menambah parameter air limbah terlebih dahulu.', 'warning');
        return;
      }
      setWastewaterRows(current => ['Inlet', 'Outlet'].map(samplePoint => (
        current.find(row => row.samplePoint === samplePoint) || { samplePoint, parameters: parametersFor('wastewater') }
      )));
    }
    setTableGenerated(true);
  };

  const updateResult = (rowType, rowId, parameterIndex, value) => {
    const update = rows => rows.map(row => {
      const matches = rowType === 'clean' ? row.locationId === rowId : row.samplePoint === rowId;
      if (!matches) return row;
      return {
        ...row,
        parameters: row.parameters.map((parameter, index) => index !== parameterIndex ? parameter : {
          ...parameter,
          result: value,
          status: calculateParameterStatus(value, parameter.standard),
        }),
      };
    });
    if (rowType === 'clean') setCleanRows(update);
    else setWastewaterRows(update);
  };

  const editRecord = async record => {
    if (record.water_type === 'clean' && record.parameters?.some(item => !['coliform', 'totalcoliform', 'ecoli'].includes(String(item.parameter || '').toLowerCase().replace(/[^a-z0-9]/g, '')))) {
      const { isConfirmed } = await Swal.fire({
        icon: 'warning', title: 'Data air bersih lama',
        text: 'Data ini memuat parameter lain. Jika dilanjutkan, parameter lain tersebut tidak ikut tersimpan saat Anda mengedit. Hasil lama tetap terlihat bila dibatalkan.',
        showCancelButton: true, confirmButtonText: 'Lanjutkan Edit', cancelButtonText: 'Batal',
      });
      if (!isConfirmed) return;
    }
    const rawParameters = record.water_type === 'clean' ? toCleanWaterParameters(record.parameters) : (record.parameters || []);
    const parameters = withCurrentStandards(rawParameters, standards, record.water_type);
    setForm({
      ...createWaterForm(record.water_type), ...record,
      clean_water_location_id: record.clean_water_location_id || '',
      resulted_at: record.resulted_at || '', laboratory: record.laboratory || '',
      report_number: record.report_number || '', notes: record.notes || '', parameters,
    });
    if (record.water_type === 'clean') {
      setCleanRows([{ locationId: record.clean_water_location_id, locationName: record.water_clean_locations?.name || 'Lokasi nonaktif', parameters }]);
      setWastewaterRows([]);
    } else {
      setCleanRows([]);
      setWastewaterRows([{ samplePoint: record.sample_point, parameters }]);
    }
    setTableGenerated(true);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async event => {
    event.preventDefault();
    if (!tableGenerated) return Swal.fire('Tabel Belum Dibuat', 'Klik Generate Tabel sebelum menyimpan.', 'warning');
    const rows = form.water_type === 'clean' ? cleanRows : wastewaterRows;
    for (const row of rows) {
      const rowForm = form.water_type === 'clean'
        ? { ...form, clean_water_location_id: row.locationId, parameters: row.parameters }
        : { ...form, sample_point: row.samplePoint, parameters: row.parameters };
      const invalid = validateExamination(rowForm);
      if (invalid) return Swal.fire('Data Belum Lengkap', `${row.locationName || row.samplePoint}: ${invalid}`, 'warning');
    }
    setSaving(true);
    try {
      await Promise.all(rows.map(row => saveWaterExamination({
        ...form,
        id: form.id && rows.length === 1 ? form.id : null,
        clean_water_location_id: row.locationId,
        sample_point: row.samplePoint,
        parameters: row.parameters,
      }, user?.id)));
      await loadRecords();
      setShowForm(false);
      resetGeneratedTable();
      setForm(createWaterForm(form.water_type));
      Swal.fire({ icon: 'success', title: 'Data Tersimpan', timer: 1400, showConfirmButton: false });
    } catch (error) {
      Swal.fire('Gagal Menyimpan', waterErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async record => {
    const location = record.water_type === 'clean' ? record.water_clean_locations?.name : record.sample_point;
    const confirmation = await Swal.fire({
      icon: 'warning', title: 'Hapus hasil pemeriksaan?', text: `${location} • ${record.sampled_at}`,
      showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626',
    });
    if (!confirmation.isConfirmed) return;
    try {
      await deleteWaterExamination(record.id);
      await loadRecords();
    } catch (error) {
      Swal.fire('Gagal Menghapus', waterErrorMessage(error), 'error');
    }
  };

  return {
    form, records, totals, month, typeFilter, loading, saving, showForm, tableGenerated,
    cleanRows, wastewaterRows, setMonth, setTypeFilter, setShowForm, changeField,
    openNew, generateTable, updateResult, editRecord, removeRecord, submit, loadRecords,
  };
}
