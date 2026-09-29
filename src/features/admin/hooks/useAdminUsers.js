import { useState, useEffect, useCallback } from 'react';
import * as adminService from '../services/adminService';
import {
  buildUserNipState,
  createUserNipSettingValue,
  findActiveKepalaUnit,
  getUpdatedKepalaUnit,
  getUserNipSettingKey,
  getUserNipSettingKeys,
  KEPALA_UNIT_SETTING_KEY,
} from '../../../lib/userNipSettings';
export default function useAdminUsers(enabled) {
  // User Management State
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [kepalaUnit, setKepalaUnit] = useState(null);
  const [userNips, setUserNips] = useState({});
  const [verifiedNips, setVerifiedNips] = useState({});
  const [settingsReady, setSettingsReady] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSettingsReady(false);
    try {
      const { data, error: err } = await adminService.listUsers();

      if (err) throw new Error(`Gagal memuat daftar pengguna: ${err.message}`);

      const profiles = data || [];
      setUsers(profiles);

      const settingKeys = getUserNipSettingKeys(profiles);
      const { data: storedSettings, error: readError } = await adminService.readUserSettings(settingKeys);

      if (readError) {
        throw new Error(`Pengaturan NIP gagal dibaca dari database: ${readError.message}`);
      }

      let currentState = buildUserNipState(profiles, storedSettings || []);

      if (currentState.migrationSettings.length > 0) {
        const { error: migrationError } = await adminService.migrateUserSettings(currentState.migrationSettings);

        if (migrationError) {
          throw new Error(`Migrasi NIP lama gagal disimpan: ${migrationError.message}`);
        }

        const { data: migratedSettings, error: rereadError } = await adminService.readUserSettings(settingKeys);

        if (rereadError) {
          throw new Error(`Pengaturan NIP gagal diverifikasi: ${rereadError.message}`);
        }

        currentState = buildUserNipState(profiles, migratedSettings || []);
      }

      const activeKepalaProfile = findActiveKepalaUnit(currentState.kepalaUnit, profiles);
      const updatedKepalaUnit = activeKepalaProfile
        ? getUpdatedKepalaUnit(
            { ...currentState.kepalaUnit, nama: activeKepalaProfile.nama },
            currentState.nips,
            currentState.verifiedNips
          )
        : null;
      const kepalaChanged = JSON.stringify(updatedKepalaUnit)
        !== JSON.stringify(currentState.kepalaUnit || null);

      if (kepalaChanged) {
        const { error: settingError } = await adminService.saveSetting(KEPALA_UNIT_SETTING_KEY, updatedKepalaUnit);

        if (settingError) {
          throw new Error(`Validasi Kepala Unit gagal disimpan: ${settingError.message}`);
        }
      }

      Object.entries(currentState.nips).forEach(([userId, nip]) => {
        localStorage.setItem(
          `insan_j_setting_${getUserNipSettingKey(userId)}`,
          JSON.stringify(createUserNipSettingValue(nip, currentState.verifiedNips[userId]))
        );
      });
      localStorage.setItem(
        `insan_j_setting_${KEPALA_UNIT_SETTING_KEY}`,
        JSON.stringify(updatedKepalaUnit)
      );
      setUserNips(currentState.nips);
      setVerifiedNips(currentState.verifiedNips);
      setKepalaUnit(updatedKepalaUnit);
      setSettingsReady(true);
    } catch (err) {
      setError(err.message || 'Gagal memuat data pengguna dan pengaturan NIP.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (enabled) fetchUsers(); }, [enabled, fetchUsers]);
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.nama?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) ||
      userNips[u.id]?.includes(q)
    );
  });

  return { users, loading, error, searchQuery, setSearchQuery, kepalaUnit, setKepalaUnit, userNips, setUserNips, verifiedNips, setVerifiedNips, settingsReady, fetchUsers, filteredUsers };
}
