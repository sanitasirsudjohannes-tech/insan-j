import { useCallback, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  MAX_BOUNDARY_POINTS,
  boundaryHasChanges,
  boundaryPointFromValue,
  parseBoundaryCoordinateLines,
  validateBoundaryPoints,
} from '../domain/hospitalBoundary';
import { clearHospitalBoundary, saveHospitalBoundary } from '../services/hospitalBoundaryMutations';

const EMPTY_INPUT = { latitude: '', longitude: '' };

function pointKey(point) {
  return `${point.latitude.toFixed(9)},${point.longitude.toFixed(9)}`;
}

export default function useHospitalBoundaryEditor({ boundary, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);
  const [coordinateInput, setCoordinateInput] = useState(EMPTY_INPUT);
  const [bulkText, setBulkText] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);

  const draftError = useMemo(() => validateBoundaryPoints(draftPoints), [draftPoints]);
  const hasChanges = editing && boundaryHasChanges(draftPoints, boundary?.points || []);

  const beginEditing = useCallback(() => {
    setEditing(true);
    setDraftPoints((boundary?.points || []).map(point => ({ ...point })));
    setCoordinateInput(EMPTY_INPUT);
    setBulkText('');
    setActionError('');
  }, [boundary]);

  const stopEditing = useCallback(() => {
    setEditing(false);
    setDraftPoints([]);
    setCoordinateInput(EMPTY_INPUT);
    setBulkText('');
    setActionError('');
  }, []);

  const resetDraft = useCallback(() => {
    setDraftPoints((boundary?.points || []).map(point => ({ ...point })));
    setCoordinateInput(EMPTY_INPUT);
    setBulkText('');
    setActionError('');
  }, [boundary]);

  const addPoints = useCallback(points => {
    if (!points.length || saving) return false;
    if (draftPoints.length + points.length > MAX_BOUNDARY_POINTS) {
      setActionError(`Batas rumah sakit maksimal ${MAX_BOUNDARY_POINTS} titik.`);
      return false;
    }

    const keys = new Set(draftPoints.map(pointKey));
    for (const point of points) {
      const key = pointKey(point);
      if (keys.has(key)) {
        setActionError('Titik tersebut sudah ada dalam daftar.');
        return false;
      }
      keys.add(key);
    }

    setDraftPoints([...draftPoints, ...points.map(point => ({ ...point }))]);
    setActionError('');
    return true;
  }, [draftPoints, saving]);

  const addPoint = useCallback((latitude, longitude) => {
    const point = boundaryPointFromValue({ latitude, longitude });
    if (!point) {
      setActionError('Koordinat titik tidak valid.');
      return false;
    }
    return addPoints([point]);
  }, [addPoints]);

  const addInputPoint = useCallback(() => {
    const point = boundaryPointFromValue(coordinateInput);
    if (!point) {
      setActionError('Isi latitude dan longitude dengan angka yang valid.');
      return false;
    }
    if (!addPoints([point])) return false;
    setCoordinateInput(EMPTY_INPUT);
    return true;
  }, [addPoints, coordinateInput]);

  const addBulkPoints = useCallback(() => {
    const parsed = parseBoundaryCoordinateLines(bulkText);
    if (parsed.error) {
      setActionError(parsed.error);
      return false;
    }
    if (!addPoints(parsed.points)) return false;
    setBulkText('');
    return true;
  }, [addPoints, bulkText]);

  const updateCoordinateInput = useCallback((field, value) => {
    setCoordinateInput(current => ({ ...current, [field]: value }));
    setActionError('');
  }, []);

  const updatePoint = useCallback((index, latitude, longitude) => {
    if (saving) return;
    const point = boundaryPointFromValue({ latitude, longitude });
    if (!point) return;
    setDraftPoints(current => current.map((item, itemIndex) => (
      itemIndex === index ? point : item
    )));
    setActionError('');
  }, [saving]);

  const removePoint = useCallback(index => {
    if (saving) return;
    setDraftPoints(current => current.filter((_, itemIndex) => itemIndex !== index));
    setActionError('');
  }, [saving]);

  const undoPoint = useCallback(() => {
    if (saving) return;
    setDraftPoints(current => current.slice(0, -1));
    setActionError('');
  }, [saving]);

  const persistBoundary = useCallback(async points => {
    if (saving) return false;
    setSaving(true);
    try {
      await saveHospitalBoundary(points);
      await onSaved?.();
      setDraftPoints(points.map(point => ({ ...point })));
      setCoordinateInput(EMPTY_INPUT);
      setBulkText('');
      setActionError('');
      await Swal.fire({
        icon: 'success',
        title: 'Batas rumah sakit disimpan',
        timer: 1400,
        showConfirmButton: false,
      });
      return true;
    } catch (err) {
      await Swal.fire('Gagal Menyimpan', err?.message || 'Periksa koneksi lalu coba lagi.', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }, [onSaved, saving]);

  const save = useCallback(async () => {
    if (!editing || draftError || saving) return false;
    return persistBoundary(draftPoints);
  }, [draftError, draftPoints, editing, persistBoundary, saving]);

  const clearBoundary = useCallback(async () => {
    if (!boundary?.hasBoundary || saving) return false;
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Hapus batas rumah sakit?',
      text: 'Poligon batas akan dihapus dari peta. Tindakan ini tidak menghapus data fasilitas.',
      showCancelButton: true,
      confirmButtonText: 'Hapus Batas',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!isConfirmed) return false;

    setSaving(true);
    try {
      await clearHospitalBoundary();
      await onSaved?.();
      setDraftPoints([]);
      setCoordinateInput(EMPTY_INPUT);
      setBulkText('');
      setActionError('');
      await Swal.fire({
        icon: 'success',
        title: 'Batas rumah sakit dihapus',
        timer: 1400,
        showConfirmButton: false,
      });
      return true;
    } catch (err) {
      await Swal.fire('Gagal Menghapus', err?.message || 'Periksa koneksi lalu coba lagi.', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }, [boundary, onSaved, saving]);

  return {
    editing,
    draftPoints,
    coordinateInput,
    bulkText,
    actionError,
    draftError,
    saving,
    hasChanges,
    hasSavedBoundary: Boolean(boundary?.hasBoundary),
    updatedAt: boundary?.updatedAt || null,
    canSave: editing && !draftError && hasChanges && !saving,
    beginEditing,
    stopEditing,
    resetDraft,
    addPoint,
    addInputPoint,
    addBulkPoints,
    updateCoordinateInput,
    updatePoint,
    removePoint,
    undoPoint,
    setBulkText,
    save,
    clearBoundary,
  };
}
