import WelcomeBanner from './WelcomeBanner';
import { Link } from 'react-router-dom';
import AppLayout from '../AppLayout';

export default function DashboardMahasiswa({ user }) {
  return (
    <AppLayout title="Dashboard Mahasiswa Praktik">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <WelcomeBanner user={user} student />

        <Link
          to="/limbah-dihasilkan"
          className="group flex items-center gap-4 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-xl text-emerald-700">
            <i className="fas fa-recycle" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-extrabold text-gray-800">Input Data Limbah</h3>
            <p className="mt-1 text-sm text-gray-500">Limbah per ruangan dan limbah anorganik.</p>
          </div>
          <i className="fas fa-chevron-right text-gray-300 transition group-hover:translate-x-1 group-hover:text-emerald-600" />
        </Link>
      </div>
    </AppLayout>
  );
}
