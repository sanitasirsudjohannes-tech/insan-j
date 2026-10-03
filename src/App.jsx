import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGate from './features/session/RoleGate';
import { loadAdminPage, loadRekapPage } from './features/navigation/routeModules';
import { getCachedUser } from './lib/session';

// Lazy loading components
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Akun = lazy(() => import('./pages/Akun'));
const Riwayat = lazy(() => import('./pages/Riwayat'));
const KelolaAdmin = lazy(loadAdminPage);
const Inspeksi = lazy(() => import('./pages/Inspeksi'));
const LimbahDihasilkan = lazy(() => import('./pages/LimbahDihasilkan'));
const PengangkutanLimbah = lazy(() => import('./pages/PengangkutanLimbah'));
const RekapLimbah = lazy(loadRekapPage);
const PemeriksaanAir = lazy(() => import('./pages/PemeriksaanAir'));
const AsistenLaporan = lazy(() => import('./pages/AsistenLaporan'));

// Loading component
const EntryRoute = () => {
  // Jika pengguna sudah memiliki sesi/cache login, buka aplikasi langsung
  // ke dashboard seperti alur sebelum landing page ditambahkan.
  const cachedUser = getCachedUser();
  return cachedUser ? <Navigate to="/dashboard" replace /> : <LandingPage />;
};

const LoadingScreen = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
    <p className="text-gray-500 font-bold tracking-widest text-xs">MENGAMBIL DATA...</p>
  </div>
);

function App() {
  return (
    <HashRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<EntryRoute />} />
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={
            <RoleGate>
              <Dashboard />
            </RoleGate>
          } />

          <Route path="/akun" element={
            <RoleGate>
              <Akun />
            </RoleGate>
          } />

          <Route path="/riwayat" element={
            <RoleGate deniedRoles={['mahasiswa']}>
              <Riwayat />
            </RoleGate>
          } />

          <Route path="/kelola-admin" element={
            <RoleGate requiredRole="admin">
              <KelolaAdmin />
            </RoleGate>
          } />

          <Route path="/inspeksi" element={
            <RoleGate deniedRoles={['mahasiswa']}>
              <Inspeksi />
            </RoleGate>
          } />

          <Route path="/limbah-dihasilkan" element={
            <RoleGate allowedRoles={['petugas', 'mahasiswa', 'user']}>
              <LimbahDihasilkan />
            </RoleGate>
          } />

          {/* Redirect route lama ke route baru */}
          <Route path="/limbah-padat" element={<Navigate to="/limbah-dihasilkan" replace />} />
          <Route path="/limbah-ruangan" element={<Navigate to="/limbah-dihasilkan" replace />} />

          <Route path="/pengangkutan" element={
            <RoleGate deniedRoles={['mahasiswa']}>
              <PengangkutanLimbah />
            </RoleGate>
          } />

          <Route path="/rekap-limbah" element={
            <RoleGate deniedRoles={['mahasiswa']}>
              <RekapLimbah />
            </RoleGate>
          } />

          <Route path="/asisten-laporan" element={
            <RoleGate deniedRoles={['mahasiswa']}>
              <AsistenLaporan />
            </RoleGate>
          } />

          <Route path="/pemeriksaan-air" element={
            <RoleGate allowedRoles={['petugas', 'user']}>
              <PemeriksaanAir />
            </RoleGate>
          } />

          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

export default App;
