import { useState, useEffect, useCallback } from 'react';
import * as adminService from '../services/adminService';
import MySwal from '../presentation/adminAlert';
import { cacheRuangan } from '../../../lib/api';
export default function useAdminRooms(enabled) {
  // Ruangan Management State
  const [ruanganList, setRuanganList] = useState([]);
  const [loadingRuangan, setLoadingRuangan] = useState(false);
  const [searchRuangan, setSearchRuangan] = useState('');
  const [newRuanganName, setNewRuanganName] = useState('');
  const [addingRuangan, setAddingRuangan] = useState(false);

  const fetchRuangan = useCallback(async () => {
    setLoadingRuangan(true);
    try {
      const { data, error: err } = await adminService.listRooms();

      if (err) throw err;
      setRuanganList(data || []);
      cacheRuangan((data || []).map(item => item.nama_ruangan));
    } catch (err) {
      console.warn('Gagal mengambil daftar ruangan:', err);
      setRuanganList([]);
    } finally {
      setLoadingRuangan(false);
    }
  }, []);

  useEffect(() => { if (enabled) fetchRuangan(); }, [enabled, fetchRuangan]);
  const handleAddRuangan = async (e) => {
    e.preventDefault();
    if (!newRuanganName.trim()) return;

    setAddingRuangan(true);
    try {
      const { error: err } = await adminService.addRoom(newRuanganName.trim());

      if (err) throw err;

      MySwal.fire({
        icon: 'success',
        title: 'Ruangan Ditambahkan!',
        text: `Ruangan "${newRuanganName.trim()}" berhasil ditambahkan ke database.`,
        timer: 2000,
        showConfirmButton: false
      });

      setNewRuanganName('');
      fetchRuangan();
    } catch (err) {
      MySwal.fire('Gagal', err.message || 'Pastikan tabel ruangan sudah dibuat di database Supabase.', 'error');
    } finally {
      setAddingRuangan(false);
    }
  };

  const handleDeleteRuangan = async (item) => {
    const { isConfirmed } = await MySwal.fire({
      title: 'Hapus Ruangan?',
      text: `Ruangan "${item.nama_ruangan}" akan dihapus dari master ruangan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Ya, Hapus!'
    });

    if (!isConfirmed) return;

    try {
      const { error: err } = await adminService.deleteRoom(item.id);
      if (err) throw err;

      MySwal.fire('Terhapus', 'Ruangan berhasil dihapus.', 'success');
      fetchRuangan();
    } catch (err) {
      MySwal.fire('Gagal Hapus', err.message, 'error');
    }
  };

  const filteredRuangan = ruanganList.filter((r) =>
    r.nama_ruangan?.toLowerCase().includes(searchRuangan.toLowerCase())
  );

  return { ruanganList, loadingRuangan, searchRuangan, setSearchRuangan, newRuanganName, setNewRuanganName, addingRuangan, fetchRuangan, handleAddRuangan, handleDeleteRuangan, filteredRuangan };
}
