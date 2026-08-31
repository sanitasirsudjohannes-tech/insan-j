import { ITEMS_PER_PAGE } from '../lib/limbah/constants';
import AppLayout from '../components/AppLayout';
import { getCurrentUser } from '../lib/api';
import AnorganikForm from '../components/limbah/anorganik/AnorganikForm';
import AnorganikTable from '../components/limbah/anorganik/AnorganikTable';
import OfflineBanner from '../components/limbah/OfflineBanner';
import Pagination from '../components/limbah/Pagination';
import useAnorganikData from '../hooks/limbah/useAnorganikData';
import useAnorganikForm from '../hooks/limbah/useAnorganikForm';
import { printAnorganikReport } from '../lib/limbah/anorganikReport';
function EmbeddedWrapper({
  children
}) {
  return <div className="bg-gray-100 min-h-screen">{children}</div>;
}
function FullWrapper({
  children
}) {
  return <AppLayout title="Limbah Anorganik">{children}</AppLayout>;
}

export default function LimbahAnorganik({ embedded = false }) {
  const user = getCurrentUser();
  const isMahasiswa = user?.role?.toLowerCase() === 'mahasiswa';
  const {
    data,
    loading,
    page,
    setPage,
    totalData,
    offlineQueueCount,
    filterMonth,
    setFilterMonth,
    fetchData,
    ruanganList,
    filterRuangan,
    setFilterRuangan
  } = useAnorganikData();
  const {
    formData,
    setFormData,
    submitting,
    handleInputChange,
    handleSubmit,
    handleEdit,
    handleCancelEdit,
    handleDelete,
    showRuanganSheet,
    setShowRuanganSheet
  } = useAnorganikForm({
    user,
    fetchData
  });
  const handlePrint = () => printAnorganikReport({
    filterMonth,
    ruanganList
  });
  const totalPages = Math.ceil(totalData / ITEMS_PER_PAGE);
  const Wrapper = embedded ? EmbeddedWrapper : FullWrapper;

  return (
    <Wrapper>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-linear-to-r from-cyan-600 via-sky-600 to-blue-700 text-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
                <span className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <i className="fas fa-recycle text-xl" />
                </span>
                Input Data Limbah Anorganik
              </h1>
              <p className="text-cyan-100 text-sm mt-1">
                Catat timbulan limbah anorganik per ruangan/unit (infus, jerigen, kertas, kardus, botol mineral, bayclin dll).
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 self-start md:self-auto">
              <i className="fas fa-hospital text-cyan-200" />
              <span className="text-xs font-bold uppercase tracking-wider">{ruanganList.length} Ruangan Terdaftar</span>
            </div>
          </div>
        </div>

        <AnorganikForm
          formData={formData}
          setFormData={setFormData}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          handleCancelEdit={handleCancelEdit}
          submitting={submitting}
          user={user}
          ruanganList={ruanganList}
          showRuanganSheet={showRuanganSheet}
          setShowRuanganSheet={setShowRuanganSheet}
        />

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <OfflineBanner data={data} totalOfflineCount={offlineQueueCount} />
          <AnorganikTable
            data={data}
            loading={loading}
            page={page}
            itemsPerPage={ITEMS_PER_PAGE}
            filterMonth={filterMonth}
            filterRuangan={filterRuangan}
            ruanganList={ruanganList}
            totalData={totalData}
            setFilterMonth={setFilterMonth}
            setFilterRuangan={setFilterRuangan}
            setPage={setPage}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPrint={isMahasiswa ? undefined : handlePrint}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            accentColor="cyan"
          />
        </div>
      </div>
    </Wrapper>
  );
}
