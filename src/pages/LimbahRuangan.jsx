import { ITEMS_PER_PAGE } from '../lib/limbah/constants';
import AppLayout from '../components/AppLayout';
import { getCurrentUser } from '../lib/api';
import RuanganForm from '../components/limbah/ruangan/RuanganForm';
import RuanganImportExportToolbar from '../components/limbah/ruangan/RuanganImportExportToolbar';
import RuanganTable from '../components/limbah/ruangan/RuanganTable';
import OfflineBanner from '../components/limbah/OfflineBanner';
import Pagination from '../components/limbah/Pagination';
import useRuanganData from '../hooks/limbah/useRuanganData';
import useRuanganForm, { EMPTY_FORM } from '../hooks/limbah/useRuanganForm';
import useRuanganReports from '../hooks/limbah/useRuanganReports';
function EmbeddedWrapper({
  children
}) {
  return <div className="bg-gray-100 min-h-screen">{children}</div>;
}
function FullWrapper({
  children
}) {
  return <AppLayout title="Limbah Per Ruangan">{children}</AppLayout>;
}

export default function LimbahRuangan({ embedded = false }) {
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
    setFilterRuangan,
    filterDate,
    setFilterDate,
    setData,
    setTotalData,
    setOfflineQueueCount
  } = useRuanganData();
  const {
    formData,
    setFormData,
    submitting,
    handleInputChange,
    handleSubmit,
    handleEdit,
    handleDelete,
    showRuanganSheet,
    setShowRuanganSheet
  } = useRuanganForm({
    user,
    fetchData,
    page,
    filterDate,
    filterMonth,
    filterRuangan,
    setData,
    setTotalData,
    setOfflineQueueCount
  });
  const {
    importing,
    importInputRef,
    handleExportExcel,
    handleDownloadTemplate,
    handleImportFile,
    handlePrint
  } = useRuanganReports({
    user,
    filterMonth,
    fetchData,
    ruanganList
  });
  const totalPages = Math.ceil(totalData / ITEMS_PER_PAGE);
  const Wrapper = embedded ? EmbeddedWrapper : FullWrapper;

  return (
    <Wrapper>
      <div className="container mx-auto px-4 py-8">

        {/* Header */}
        <div className="bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
                <span className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><i className="fas fa-door-open text-xl" /></span>
                Input Data Limbah Per Ruangan
              </h1>
              <p className="text-emerald-100 text-sm mt-1">Catat timbulan limbah medis padat per unit/ruangan rumah sakit.</p>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 self-start md:self-auto">
              <i className="fas fa-hospital text-emerald-200" />
              <span className="text-xs font-bold uppercase tracking-wider">{ruanganList.length} Ruangan Terdaftar</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <RuanganForm
          formData={formData}
          emptyForm={EMPTY_FORM}
          setFormData={setFormData}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          submitting={submitting}
          user={user}
          ruanganList={ruanganList}
          showRuanganSheet={showRuanganSheet}
          setShowRuanganSheet={setShowRuanganSheet}
        />

        {/* Toolbar */}
        {!isMahasiswa && (
          <RuanganImportExportToolbar
            importing={importing}
            importInputRef={importInputRef}
            onDownloadTemplate={handleDownloadTemplate}
            onImportFile={handleImportFile}
            onExportExcel={handleExportExcel}
          />
        )}

        {/* Tabel */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <OfflineBanner
            data={data}
            totalOfflineCount={offlineQueueCount}
          />
          <RuanganTable
            data={data}
            loading={loading}
            page={page}
            itemsPerPage={ITEMS_PER_PAGE}
            totalData={totalData}
            filterMonth={filterMonth}
            filterDate={filterDate}
            filterRuangan={filterRuangan}
            ruanganList={ruanganList}
            setFilterMonth={setFilterMonth}
            setFilterDate={setFilterDate}
            setFilterRuangan={setFilterRuangan}
            setPage={setPage}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPrint={isMahasiswa ? undefined : handlePrint}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} accentColor="emerald" />
        </div>

      </div>
    </Wrapper>
  );
}
