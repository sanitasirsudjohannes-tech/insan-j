import { lazy, Suspense, useState } from 'react';
import AppLayout from '../components/AppLayout';
import { getCurrentUser } from '../lib/api';
import AdminHeader from '../components/kelola-admin/AdminHeader';
import AdminLoading from '../features/admin/presentation/AdminLoading';
import useAdminAccess from '../features/admin/hooks/useAdminAccess';
import useAdminUsers from '../features/admin/hooks/useAdminUsers';
import useAdminNips from '../features/admin/hooks/useAdminNips';
import useAdminAccounts from '../features/admin/hooks/useAdminAccounts';
import useAdminRooms from '../features/admin/hooks/useAdminRooms';
import useAdminSettings from '../features/admin/hooks/useAdminSettings';
const PenggunaTab = lazy(() => import('../components/kelola-admin/PenggunaTab'));
const TambahPenggunaTab = lazy(() => import('../components/kelola-admin/TambahPenggunaTab'));
const RuanganTab = lazy(() => import('../components/kelola-admin/RuanganTab'));
const LokasiAirBersihTab = lazy(() => import('../components/kelola-admin/LokasiAirBersihTab'));
const BakuMutuAirTab = lazy(() => import('../components/kelola-admin/BakuMutuAirTab'));
const PengaturanTab = lazy(() => import('../components/kelola-admin/PengaturanTab'));
const MaintenancePanel = lazy(() => import('../features/admin/presentation/MaintenancePanel'));

export default function KelolaAdmin() {
  const user = getCurrentUser();
  const { verified, retrySession } = useAdminAccess(user);
  const [activeTab, setActiveTab] = useState('pengguna');
  const usersState = useAdminUsers(verified === true);
  const { users, loading, error, searchQuery, setSearchQuery, kepalaUnit, userNips, verifiedNips, settingsReady, fetchUsers, filteredUsers } = usersState;
  const { savingNipId, savingKepalaUnit, handleSetKepalaUnit, handleVerifyNip, handleEditNip, handleDeleteNip } = useAdminNips(usersState);
  const { resettingId, deletingUserId, creatingUser, handleResetPassword, handleDeleteUser, handleCreateUser } = useAdminAccounts({ user, fetchUsers, setActiveTab });
  const { ruanganList, loadingRuangan, searchRuangan, setSearchRuangan, newRuanganName, setNewRuanganName, addingRuangan, fetchRuangan, handleAddRuangan, handleDeleteRuangan, filteredRuangan } = useAdminRooms(verified === true && activeTab === 'ruangan');
  const { formLimbahPadatEnabled, savingSettings, handleToggleFormLimbahPadat } = useAdminSettings(verified === true && activeTab === 'pengaturan');
  if (!verified) return <AppLayout title="Kelola Admin"><div role="alert" className="m-4 rounded-2xl bg-white p-6 text-sm text-slate-600"><p>Hubungkan internet untuk memverifikasi akses administrator.</p><button type="button" onClick={retrySession} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-white">Coba lagi</button></div></AppLayout>;
  return (
    <AppLayout title="Kelola Pengguna & Master Data" showBackButton={false}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <AdminHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userCount={users.length}
          roomCount={activeTab === 'ruangan' ? ruanganList.length : null}
        />

        <Suspense fallback={<AdminLoading />}>
        {/* TAB 1: KELOLA PENGGUNA */}
        {activeTab === 'pengguna' && (
          <PenggunaTab
            users={users}
            filteredUsers={filteredUsers}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            loading={loading}
            error={error}
            resettingId={resettingId}
            deletingUserId={deletingUserId}
            user={user}
            fetchUsers={fetchUsers}
            handleResetPassword={handleResetPassword}
            handleDeleteUser={handleDeleteUser}
            kepalaUnit={kepalaUnit}
            savingKepalaUnit={savingKepalaUnit}
            handleSetKepalaUnit={handleSetKepalaUnit}
            userNips={userNips}
            verifiedNips={verifiedNips}
            savingNipId={savingNipId}
            settingsReady={settingsReady}
            handleEditNip={handleEditNip}
            handleDeleteNip={handleDeleteNip}
            handleVerifyNip={handleVerifyNip}
          />
        )}

        {/* TAB 2: TAMBAH PENGGUNA */}
        {activeTab === 'tambah-pengguna' && (
          <TambahPenggunaTab
            onSubmit={handleCreateUser}
            submitting={creatingUser}
          />
        )}

        {/* TAB 3: MASTER RUANGAN */}
        {activeTab === 'ruangan' && (
          <RuanganTab
            filteredRuangan={filteredRuangan}
            searchRuangan={searchRuangan}
            setSearchRuangan={setSearchRuangan}
            newRuanganName={newRuanganName}
            setNewRuanganName={setNewRuanganName}
            addingRuangan={addingRuangan}
            loadingRuangan={loadingRuangan}
            handleAddRuangan={handleAddRuangan}
            handleDeleteRuangan={handleDeleteRuangan}
            fetchRuangan={fetchRuangan}
          />
        )}

        {activeTab === 'lokasi-air-bersih' && <LokasiAirBersihTab />}
        {activeTab === 'baku-mutu-air' && <BakuMutuAirTab />}

        {/* TAB 4: PENGATURAN */}
        {activeTab === 'pengaturan' && (
          <PengaturanTab
            formLimbahPadatEnabled={formLimbahPadatEnabled}
            savingSettings={savingSettings}
            handleToggleFormLimbahPadat={handleToggleFormLimbahPadat}
          />
        )}

        {/* TAB 5: PEMELIHARAAN DATA */}
        {activeTab === 'pemeliharaan' && (
          <MaintenancePanel user={user} />
        )}
        </Suspense>
      </div>
    </AppLayout>
  );
}
