import { useState, useEffect } from 'react';
import MySwal from '../presentation/adminAlert';
import { getSetting } from '../../../lib/api';
import { saveSetting } from '../services/adminService';
export default function useAdminSettings(enabled) {
  const [formLimbahPadatEnabled, setFormLimbahPadatEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  useEffect(() => {
    let active = true;
    if (enabled) getSetting('form_limbah_padat_enabled', true).then(value => { if (active) setFormLimbahPadatEnabled(value); });
    return () => { active = false; };
  }, [enabled]);
  const handleToggleFormLimbahPadat = async (enabled) => {
    setSavingSettings(true);
    try {
      const { error } = await saveSetting('form_limbah_padat_enabled', enabled);
      if (error) throw error;
      setFormLimbahPadatEnabled(enabled);
      try { localStorage.setItem('insan_j_setting_form_limbah_padat_enabled', JSON.stringify(enabled)); } catch { /* Server remains authoritative. */ }
      // Broadcast ke komponen LimbahPadat yang sedang terbuka
      window.dispatchEvent(new CustomEvent('app-setting-changed', {
        detail: { key: 'form_limbah_padat_enabled', value: enabled }
      }));

      MySwal.fire({
        icon: 'success',
        title: enabled ? 'Form Diaktifkan!' : 'Form Dinonaktifkan!',
        text: enabled
          ? 'Form input Limbah Padat kini aktif dan dapat digunakan petugas.'
          : 'Form input Limbah Padat telah dimatikan. Data tabel tetap terlihat.',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      });
    } catch (error) {
      MySwal.fire('Pengaturan belum tersimpan', error.message || 'Periksa koneksi lalu coba kembali.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  return { formLimbahPadatEnabled, savingSettings, handleToggleFormLimbahPadat };
}
