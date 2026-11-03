import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { coordinateInputsFromDraft, coordinatesEqual, draftFromFacility } from '../domain/facilityMapModel';
import { isValidCoordinate, parseCoordinate, validateCoordinateDraft } from '../domain/mapCoordinates';
import { deleteFacilityCoordinates, saveFacilityCoordinates } from '../services/facilityMapMutations';

const EMPTY_INPUTS = { latitude: '', longitude: '' };

export default function useFacilityMapEditor({ facilities, onSaved }) {
  const [selectedKey, setSelectedKey] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [coordinateInputs, setCoordinateInputs] = useState(EMPTY_INPUTS);
  const [saving, setSaving] = useState(false);

  const selectedFacility = useMemo(
    () => facilities.find(facility => facility.key === selectedKey) || null,
    [facilities, selectedKey],
  );

  useEffect(() => {
    if (!selectedKey) return;
    if (!selectedFacility) setSelectedKey(null);
  }, [selectedFacility, selectedKey]);

  useEffect(() => {
    if (!editing) return;
    const nextDraft = draftFromFacility(selectedFacility);
    setDraft(nextDraft);
    setCoordinateInputs(coordinateInputsFromDraft(nextDraft));
  }, [editing, selectedFacility]);

  const selectFacility = useCallback(facility => {
    setSelectedKey(facility?.key || null);
    if (editing) {
      const nextDraft = draftFromFacility(facility);
      setDraft(nextDraft);
      setCoordinateInputs(coordinateInputsFromDraft(nextDraft));
    }
  }, [editing]);

  const beginEditing = useCallback(() => {
    setEditing(true);
  }, []);

  const stopEditing = useCallback(() => {
    setEditing(false);
    setDraft(null);
    setCoordinateInputs(EMPTY_INPUTS);
  }, []);

  const placeAt = useCallback((latitude, longitude) => {
    if (!editing || !selectedFacility) return;
    const lat = parseCoordinate(latitude);
    const lng = parseCoordinate(longitude);
    if (!isValidCoordinate(lat, lng)) return;
    const nextDraft = { latitude: lat, longitude: lng };
    setDraft(nextDraft);
    setCoordinateInputs(coordinateInputsFromDraft(nextDraft));
  }, [editing, selectedFacility]);

  const updateCoordinateInput = useCallback((field, value) => {
    const nextInputs = { ...coordinateInputs, [field]: value };
    setCoordinateInputs(nextInputs);
    const lat = parseCoordinate(nextInputs.latitude);
    const lng = parseCoordinate(nextInputs.longitude);
    setDraft(isValidCoordinate(lat, lng) ? { latitude: lat, longitude: lng } : null);
  }, [coordinateInputs]);

  const clearDraft = useCallback(() => {
    setDraft(null);
    setCoordinateInputs(EMPTY_INPUTS);
  }, []);

  const resetDraft = useCallback(() => {
    const nextDraft = draftFromFacility(selectedFacility);
    setDraft(nextDraft);
    setCoordinateInputs(coordinateInputsFromDraft(nextDraft));
  }, [selectedFacility]);

  const draftError = useMemo(
    () => (editing ? validateCoordinateDraft(coordinateInputs) : ''),
    [coordinateInputs, editing],
  );

  const hasChanges = Boolean(
    editing
    && selectedFacility
    && !coordinatesEqual(draft, draftFromFacility(selectedFacility)),
  );

  const persistForFacility = useCallback(async (facility, coordinates) => {
    if (!facility || saving) return false;
    setSaving(true);
    try {
      if (coordinates) {
        await saveFacilityCoordinates(facility, coordinates);
      } else {
        await deleteFacilityCoordinates(facility);
      }
      await onSaved?.();
      if (facility.key === selectedKey) {
        setDraft(coordinates);
        setCoordinateInputs(coordinateInputsFromDraft(coordinates));
      }
      await Swal.fire({
        icon: 'success',
        title: coordinates ? 'Titik peta disimpan' : 'Titik peta dihapus',
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
  }, [onSaved, saving, selectedKey]);

  const save = useCallback(async () => {
    if (!hasChanges || draftError) return false;
    return persistForFacility(selectedFacility, draft);
  }, [draft, draftError, hasChanges, persistForFacility, selectedFacility]);

  const clearCoordinates = useCallback(async () => {
    if (!selectedFacility?.hasCoordinates || saving) return false;
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Hapus titik dari peta?',
      text: `Titik ${selectedFacility.name} akan dihapus, tetapi data master tetap tersimpan.`,
      showCancelButton: true,
      confirmButtonText: 'Hapus Titik',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!isConfirmed) return false;
    return persistForFacility(selectedFacility, null);
  }, [persistForFacility, saving, selectedFacility]);

  const removeFacilityCoordinates = useCallback(async facility => {
    if (!facility?.hasCoordinates || saving) return false;
    return persistForFacility(facility, null);
  }, [persistForFacility, saving]);

  return {
    selectedKey,
    selectedFacility,
    editing,
    draft,
    coordinateInputs,
    draftError,
    saving,
    hasChanges,
    selectFacility,
    beginEditing,
    stopEditing,
    placeAt,
    updateCoordinateInput,
    clearDraft,
    resetDraft,
    save,
    clearCoordinates,
    removeFacilityCoordinates,
  };
}
