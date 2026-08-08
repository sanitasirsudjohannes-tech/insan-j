import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy loading components
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Akun = lazy(() => import('./pages/Akun'));
const Riwayat = lazy(() => import('./pages/Riwayat'));
const KelolaAdmin = lazy(() => import('./pages/KelolaAdmin'));
const Inspeksi = lazy(() => import('./pages/Inspeksi'));
const LimbahPadat = lazy(() => import('./pages/LimbahPadat'));
const LimbahRuangan = lazy(() => import('./pages/LimbahRuangan'));
const PengangkutanLimbah = lazy(() => import('./pages/PengangkutanLimbah'));

// Loading component
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
          <Route path="/" element={<Login />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/akun" element={
            <ProtectedRoute>
              <Akun />
            </ProtectedRoute>
          } />

          <Route path="/riwayat" element={
            <ProtectedRoute>
              <Riwayat />
            </ProtectedRoute>
          } />

          <Route path="/kelola-admin" element={
            <ProtectedRoute>
              <KelolaAdmin />
            </ProtectedRoute>
          } />

          <Route path="/inspeksi" element={
            <ProtectedRoute>
              <Inspeksi />
            </ProtectedRoute>
          } />

          <Route path="/limbah-padat" element={
            <ProtectedRoute>
              <LimbahPadat />
            </ProtectedRoute>
          } />

          <Route path="/limbah-ruangan" element={
            <ProtectedRoute>
              <LimbahRuangan />
            </ProtectedRoute>
          } />

          <Route path="/pengangkutan" element={
            <ProtectedRoute>
              <PengangkutanLimbah />
            </ProtectedRoute>
          } />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

export default App;
