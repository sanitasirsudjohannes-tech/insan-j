import AppLayout from '../components/AppLayout';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getCurrentUser } from '../lib/api';
import { syncOfflineQueue } from '../lib/offlineStorage';
import PengangkutanForm from '../components/limbah/pengangkutan/PengangkutanForm';
import PengangkutanImportExportToolbar from '../components/limbah/pengangkutan/PengangkutanImportExportToolbar';
import PengangkutanTable from '../components/limbah/pengangkutan/PengangkutanTable';
import usePengangkutanData from '../features/pengangkutan/hooks/usePengangkutanData';
import usePengangkutanExcel from '../features/pengangkutan/hooks/usePengangkutanExcel';
import usePengangkutanMutations from '../features/pengangkutan/hooks/usePengangkutanMutations';

const MySwal = withReactContent(Swal);

export default function PengangkutanLimbah() {
    const user = getCurrentUser();
    const {
      data, loading, page, setPage, totalData, offlineQueueCount,
      filterMonth, setFilterMonth, fetchData, itemsPerPage, totalPages
    } = usePengangkutanData();
    const {
      form, setForm, emptyForm, submitting,
      handleChange, handleSubmit, handleEdit, handleDelete
    } = usePengangkutanMutations({ user, fetchData, alert: MySwal });
    const {
      importRef, importing, handleExport, handleImportFile, handleDownloadTemplate
    } = usePengangkutanExcel({ user, fetchData, alert: MySwal });

    return (
        <AppLayout title="Pengangkutan Limbah Padat">
            <div className="container mx-auto px-4 py-8 max-w-5xl">
                <PengangkutanForm
                    form={form}
                    handleChange={handleChange}
                    handleSubmit={handleSubmit}
                    submitting={submitting}
                    emptyForm={emptyForm}
                    setForm={setForm}
                />

                <PengangkutanImportExportToolbar
                    handleDownloadTemplate={handleDownloadTemplate}
                    handleImportFile={handleImportFile}
                    handleExport={handleExport}
                    importRef={importRef}
                    importing={importing}
                />

                <PengangkutanTable
                    data={data}
                    loading={loading}
                    totalData={totalData}
                    filterMonth={filterMonth}
                    setFilterMonth={setFilterMonth}
                    page={page}
                    setPage={setPage}
                    itemsPerPage={itemsPerPage}
                    totalPages={totalPages}
                    totalOfflineCount={offlineQueueCount}
                    handleEdit={handleEdit}
                    handleDelete={handleDelete}
                    syncOfflineQueue={syncOfflineQueue}
                />
            </div>
        </AppLayout>
    );
}
