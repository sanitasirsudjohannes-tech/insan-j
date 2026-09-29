import { useState } from 'react';
import * as adminService from '../services/adminService';
import MySwal from '../presentation/adminAlert';
import {
  buildUserNipState,
  createUserNipSettingValue,
  findDuplicateNipUserId,
  getUpdatedKepalaUnit,
  getUserNipSettingKey,
  getUserNipSettingKeys,
  KEPALA_UNIT_SETTING_KEY,
  parseUserNipSetting,
} from '../../../lib/userNipSettings';
export default function useAdminNips(state) {
  const { users, userNips, setUserNips, verifiedNips, setVerifiedNips, setKepalaUnit, settingsReady } = state;
  const [savingNipId, setSavingNipId] = useState(null);
  const [savingKepalaUnit, setSavingKepalaUnit] = useState(false);
  const handleSetKepalaUnit = async (userId) => {
    if (!settingsReady || savingNipId) return;

    const selectedUser = users.find((item) => item.id === userId);
    setSavingKepalaUnit(true);

    try {
      let nextKepalaUnit = null;

      if (selectedUser) {
        const { data: nipSetting, error: nipReadError } = await adminService.readSetting(getUserNipSettingKey(selectedUser.id));

        if (nipReadError) {
          throw new Error(`NIP Kepala Unit gagal dibaca: ${nipReadError.message}`);
        }

        const nipData = parseUserNipSetting(nipSetting?.value);
        nextKepalaUnit = {
          userId: selectedUser.id,
          nama: selectedUser.nama,
          nip: nipData.nip || '',
          nipVerified: nipData.verified,
        };
      }

      const { error: settingError } = await adminService.saveSetting(KEPALA_UNIT_SETTING_KEY, nextKepalaUnit);

      if (settingError) throw settingError;

      localStorage.setItem(`insan_j_setting_${KEPALA_UNIT_SETTING_KEY}`, JSON.stringify(nextKepalaUnit));
      setKepalaUnit(nextKepalaUnit);

      window.dispatchEvent(new CustomEvent('app-setting-changed', {
        detail: { key: KEPALA_UNIT_SETTING_KEY, value: nextKepalaUnit },
      }));

      MySwal.fire({
        icon: 'success',
        title: nextKepalaUnit ? 'Kepala Unit Diperbarui!' : 'Kepala Unit Dikosongkan!',
        text: nextKepalaUnit
          ? `${nextKepalaUnit.nama} akan tercantum pada tanda tangan seluruh laporan.`
          : 'Nama penandatangan tidak akan ditampilkan sampai Kepala Unit dipilih kembali.',
        timer: 2200,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      });
    } catch (err) {
      MySwal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan Kepala Unit',
        text: err.message || 'Pengaturan Kepala Unit belum berhasil disimpan ke database.',
      });
    } finally {
      setSavingKepalaUnit(false);
    }
  };

  const persistUserNip = async (targetUser, nip, verified = Boolean(nip)) => {
    if (!settingsReady || savingNipId || savingKepalaUnit) return;

    setSavingNipId(targetUser.id);

    try {
      const { data: currentSettings, error: readError } = await adminService.readUserSettings(getUserNipSettingKeys(users));

      if (readError) {
        throw new Error(`NIP terbaru gagal dibaca dari database: ${readError.message}`);
      }

      const currentState = buildUserNipState(users, currentSettings || []);
      const duplicateUserId = findDuplicateNipUserId(currentState.nips, targetUser.id, nip);

      if (duplicateUserId) {
        const duplicateUser = users.find((item) => item.id === duplicateUserId);
        throw new Error(`NIP tersebut sudah digunakan oleh ${duplicateUser?.nama || 'petugas lain'}.`);
      }

      const nextNips = { ...currentState.nips, [targetUser.id]: nip || null };
      const nextVerifiedNips = {
        ...currentState.verifiedNips,
        [targetUser.id]: Boolean(nip && verified),
      };
      const isKepalaUnit = currentState.kepalaUnit?.userId === targetUser.id;
      const nextKepalaUnit = isKepalaUnit
        ? getUpdatedKepalaUnit(currentState.kepalaUnit, nextNips, nextVerifiedNips)
        : currentState.kepalaUnit;
      const nextNipValue = createUserNipSettingValue(nip, verified);
      const settings = [{ key: getUserNipSettingKey(targetUser.id), value: nextNipValue }];

      if (isKepalaUnit) {
        settings.push({ key: KEPALA_UNIT_SETTING_KEY, value: nextKepalaUnit });
      }

      const { error: settingError } = await adminService.saveUserSettings(settings);

      if (settingError) throw settingError;

      localStorage.setItem(
        `insan_j_setting_${getUserNipSettingKey(targetUser.id)}`,
        JSON.stringify(nextNipValue)
      );
      setUserNips(nextNips);
      setVerifiedNips(nextVerifiedNips);

      if (isKepalaUnit) {
        localStorage.setItem(
          `insan_j_setting_${KEPALA_UNIT_SETTING_KEY}`,
          JSON.stringify(nextKepalaUnit)
        );
        setKepalaUnit(nextKepalaUnit);
        window.dispatchEvent(new CustomEvent('app-setting-changed', {
          detail: { key: KEPALA_UNIT_SETTING_KEY, value: nextKepalaUnit },
        }));
      }

      MySwal.fire({
        icon: 'success',
        title: nip ? 'NIP Berhasil Diverifikasi!' : 'NIP Berhasil Dihapus!',
        text: nip
          ? `NIP ${targetUser.nama} telah diperbarui.`
          : `NIP ${targetUser.nama} telah dikosongkan.`,
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      });
    } catch (err) {
      MySwal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan NIP',
        text: err.message || 'NIP belum berhasil disimpan ke pengaturan aplikasi.',
      });
    } finally {
      setSavingNipId(null);
    }
  };

  const handleVerifyNip = async (targetUser) => {
    const nip = userNips[targetUser.id];
    if (!nip || verifiedNips[targetUser.id]) return;

    const { isConfirmed } = await MySwal.fire({
      title: 'Verifikasi NIP Petugas?',
      text: `Pastikan NIP ${nip} benar-benar milik ${targetUser.nama}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, NIP Sudah Benar',
      cancelButtonText: 'Periksa Lagi',
      confirmButtonColor: '#16a34a',
    });

    if (!isConfirmed) return;
    await persistUserNip(targetUser, nip, true);
  };

  const handleEditNip = async (targetUser) => {
    const currentNip = userNips[targetUser.id] || '';
    const { isConfirmed, value } = await MySwal.fire({
      title: currentNip ? 'Ubah NIP Petugas' : 'Tambah NIP Petugas',
      text: targetUser.nama,
      input: 'text',
      inputValue: currentNip,
      inputPlaceholder: 'Masukkan NIP 18 digit',
      inputAttributes: {
        maxlength: '18',
        inputmode: 'numeric',
        autocomplete: 'off',
      },
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-save mr-2"></i>Simpan NIP',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#4f46e5',
      inputValidator: (input) => {
        const normalizedNip = String(input || '').trim();

        if (!/^\d{18}$/.test(normalizedNip)) {
          return 'NIP harus terdiri dari tepat 18 angka.';
        }

        const duplicateUserId = findDuplicateNipUserId(userNips, targetUser.id, normalizedNip);

        if (duplicateUserId) {
          const duplicateUser = users.find((item) => item.id === duplicateUserId);
          return `NIP sudah digunakan oleh ${duplicateUser?.nama || 'petugas lain'}.`;
        }

        return undefined;
      },
    });

    if (!isConfirmed) return;
    await persistUserNip(targetUser, String(value).trim());
  };

  const handleDeleteNip = async (targetUser) => {
    const { isConfirmed } = await MySwal.fire({
      title: 'Hapus NIP Petugas?',
      text: `NIP ${targetUser.nama} akan dikosongkan dan dapat ditambahkan kembali.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus NIP',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });

    if (!isConfirmed) return;
    await persistUserNip(targetUser, null);
  };

  return { savingNipId, savingKepalaUnit, handleSetKepalaUnit, handleVerifyNip, handleEditNip, handleDeleteNip };
}
