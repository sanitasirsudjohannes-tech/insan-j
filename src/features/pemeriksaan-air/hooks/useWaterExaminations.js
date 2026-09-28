import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { getCurrentUser } from '../../../lib/api';
import {
  deleteWaterExamination,
  getCleanWaterLocations,
  getWaterExaminationIndex,
  getWaterExaminationConflicts,
  getWaterExaminations,
  getWaterStandards,
  saveWaterExamination,
  saveWaterExaminationBatch,
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
  standardsForType,
} from '../domain/waterFormModel';
import { groupExaminationsByDate, groupExaminationsByMonth } from '../domain/waterRecordIndex';
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
  const [recordIndex, setRecordIndex] = useState([]);
  const [records, setRecords] = useState([]);
  const [month, setMonth] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [masterLoading, setMasterLoading] = useState(true);
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
    if (!selectedDate || !typeFilter) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRecords(await getWaterExaminations({ sampledAt: selectedDate, waterType: typeFilter }));
    } catch (error) {
      Swal.fire('Data Tidak Dapat Dimuat', waterErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, typeFilter]);

  const loadRecordIndex = useCallback(async () => {
    try {
      setRecordIndex(await getWaterExaminationIndex());
    } catch (error) {
      Swal.fire('Daftar Pemeriksaan Tidak Dapat Dimuat', waterErrorMessage(error), 'error');
    }
  }, []);

  useEffect(() => {
    Promise.all([getCleanWaterLocations(), getWaterStandards(), getWaterExaminationIndex()])
      .then(([nextLocations, nextStandards, nextIndex]) => {
        setLocations(nextLocations);
        setStandards(nextStandards);
        setRecordIndex(nextIndex);
      })
      .catch(error => Swal.fire('Data Tidak Dapat Dimuat', waterErrorMessage(error), 'error'))
      .finally(() => setMasterLoading(false));
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const monthGroups = useMemo(() => groupExaminationsByMonth(recordIndex), [recordIndex]);
  const dateGroupsByType = useMemo(() => ({
    clean: groupExaminationsByDate(recordIndex, month, 'clean'),
    wastewater: groupExaminationsByDate(recordIndex, month, 'wastewater'),
  }), [recordIndex, month]);
  const detailRecords = useMemo(() => records.filter(record => (
    record.water_type === typeFilter && record.sampled_at === selectedDate
  )), [records, selectedDate, typeFilter]);

  const selectMonth = value => {
    setMonth(value);
    setTypeFilter('');
    setSelectedDate('');
  };
  const selectDate = (waterType, date) => {
    setTypeFilter(waterType);
    setSelectedDate(date);
  };
  const refreshArchive = async () => {
    await Promise.all([loadRecordIndex(), loadRecords()]);
  };

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
    if (masterLoading) {
      Swal.fire('Mohon Tunggu', 'Lokasi dan baku mutu sedang dimuat.', 'info');
      return;
    }
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
    if (saving) return;
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
      const forms = rows.map(row => ({
        ...form,
        id: form.id && rows.length === 1 ? form.id : null,
        clean_water_location_id: row.locationId,
        sample_point: row.samplePoint,
        parameters: row.parameters,
      }));
      const conflicts = await getWaterExaminationConflicts(forms);
      if (conflicts.length) {
        const conflictNames = conflicts.map(conflict => conflict.water_type === 'clean'
          ? rows.find(row => row.locationId === conflict.clean_water_location_id)?.locationName || 'Lokasi air bersih'
          : conflict.sample_point).join(', ');
        const duplicateError = new Error(`Pemeriksaan ${conflictNames} pada tanggal ${form.sampled_at} sudah tersimpan. Edit data yang ada atau pilih tanggal lain.`);
        duplicateError.code = 'WATER_DUPLICATE';
        throw duplicateError;
      }
      if (form.id && forms.length === 1) await saveWaterExamination(forms[0], user?.id);
      else await saveWaterExaminationBatch(forms, user?.id);
      const savedMonth = form.sampled_at.slice(0, 7);
      const savedType = form.water_type;
      const savedDate = form.sampled_at;
      await loadRecordIndex();
      setMonth(savedMonth);
      setTypeFilter(savedType);
      setSelectedDate(savedDate);
      if (selectedDate === savedDate && typeFilter === savedType) {
        setRecords(await getWaterExaminations({ sampledAt: savedDate, waterType: savedType }));
      } else {
        setRecords([]);
      }
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
      setRecords(current => current.filter(item => item.id !== record.id));
      setRecordIndex(current => {
        const matchIndex = current.findIndex(item => (
          item.water_type === record.water_type && item.sampled_at === record.sampled_at
        ));
        if (matchIndex < 0) return current;
        const matched = current[matchIndex];
        const total = Number(matched.total || 1);
        if (total <= 1) return current.filter((_, index) => index !== matchIndex);
        return current.map((item, index) => index === matchIndex ? { ...item, total: total - 1 } : item);
      });
    } catch (error) {
      Swal.fire('Gagal Menghapus', waterErrorMessage(error), 'error');
    }
  };

  return {
    form, records, monthGroups, dateGroupsByType, detailRecords, month, typeFilter, selectedDate,
    loading, masterLoading, saving, showForm, tableGenerated,
    cleanRows, wastewaterRows, selectMonth, selectDate, setSelectedDate, setShowForm, changeField,
    openNew, generateTable, updateResult, editRecord, removeRecord, submit, refreshArchive,
  };
}
