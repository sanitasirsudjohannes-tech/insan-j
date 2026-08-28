import { ITEMS_PER_PAGE } from '../lib/limbah/constants';
import AppLayout from '../components/AppLayout';
import { getCurrentUser } from '../lib/api';
import PadatForm, { EMPTY_FORM } from '../components/limbah/padat/PadatForm';
import PadatImportExportToolbar from '../components/limbah/padat/PadatImportExportToolbar';
import PadatTable from '../components/limbah/padat/PadatTable';
import OfflineBanner from '../components/limbah/OfflineBanner';
import Pagination from '../components/limbah/Pagination';
import usePadatData from '../hooks/limbah/usePadatData';
import usePadatForm from '../hooks/limbah/usePadatForm';
import usePadatReports from '../hooks/limbah/usePadatReports';
function EmbeddedWrapper({
  children
}) {
  return <div className="bg-gray-100 min-h-screen">{children}</div>;
}
function FullWrapper({
  children
}) {
  return <AppLayout title="Limbah Padat">{children}</AppLayout>;
}

export default function LimbahPadat({ embedded = false }) {
  const user = getCurrentUser();
  const {
    data,
    loading,
    page,
    setPage,
    totalData,
    offlineQueueCount,
    filterMonth,
    setFilterMonth,
    fetchData
  } = usePadatData();
  const {
    formData,
    setFormData,
    submitting,
    handleInputChange,
    handleSubmit,
    handleEdit,
    handleDelete,
    formEnabled
  } = usePadatForm({
    user,
    fetchData,
    emptyForm: EMPTY_FORM
  });
  const {
    importing,
    importInputRef,
    handleExportExcel,
    handleDownloadTemplate,
    handleImportFile,
    handlePrint
  } = usePadatReports({
    user,
    filterMonth,
    fetchData
  });
  const totalPages = Math.ceil(totalData / ITEMS_PER_PAGE);
  const Wrapper = embedded ? EmbeddedWrapper : FullWrapper;

  return (
    <Wrapper>
      <div className="container mx-auto px-4 py-8">

        {formEnabled && (
          <PadatForm
            formData={formData}
            setFormData={setFormData}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            submitting={submitting}
            user={user}
          />
        )}

        {formEnabled && (
          <PadatImportExportToolbar
            importing={importing}
            importInputRef={importInputRef}
            onDownloadTemplate={handleDownloadTemplate}
            onImportFile={handleImportFile}
            onExportExcel={handleExportExcel}
          />
        )}

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <OfflineBanner data={data} totalOfflineCount={offlineQueueCount} />
          <PadatTable
            data={data}
            loading={loading}
            page={page}
            itemsPerPage={ITEMS_PER_PAGE}
            totalData={totalData}
            filterMonth={filterMonth}
            setFilterMonth={setFilterMonth}
            setPage={setPage}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPrint={handlePrint}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} accentColor="emerald" />
        </div>

      </div>
    </Wrapper>
  );
}
