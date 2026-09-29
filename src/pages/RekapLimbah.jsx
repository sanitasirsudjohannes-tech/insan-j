import AppLayout from '../components/AppLayout';
import useRekapData from '../features/rekap/hooks/useRekapData';
import useRekapPrint from '../features/rekap/hooks/useRekapPrint';
import RekapSummaryCards from '../components/limbah/rekap/RekapSummaryCards';
import RekapFilter from '../components/limbah/rekap/RekapFilter';
import RekapTable from '../components/limbah/rekap/RekapTable';
import RekapPerRuangan from '../components/limbah/rekap/RekapPerRuangan';

export default function RekapLimbah() {
  const data = useRekapData();
  const { loading, error, loadData, selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, activeTab, setActiveTab, roomMonth, setRoomMonth, roomRows, roomLoading, roomError, loadRoomData, availableYears, tableRows, summary, hasAnomaly } = data;
  const { isPrinting, handlePrint } = useRekapPrint(data);
  return (
    <AppLayout title="Rekap Limbah">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {error && <div role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{error}<button type="button" onClick={loadData} className="ml-3 underline">Coba lagi</button></div>}
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Rekap Limbah
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Rekapitulasi timbulan, pengangkutan, dan akumulasi limbah.
          </p>
        </div>

        <div className="mb-6 inline-flex w-full rounded-2xl border border-slate-200 bg-slate-100 p-1 md:w-auto" role="tablist" aria-label="Jenis rekap limbah">
          {[
            { id: 'bulanan', label: 'Rekap Bulanan', icon: 'fas fa-calendar-alt' },
            { id: 'ruangan', label: 'Per Ruangan', icon: 'fas fa-hospital' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all md:flex-none ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <i className={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'bulanan' ? (
          <>
            <RekapFilter
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              availableYears={availableYears}
              onPrint={handlePrint}
              isPrinting={isPrinting}
              printDisabled={loading || Boolean(error)}
            />
            <RekapSummaryCards summary={summary} />
            <RekapTable
              tableRows={tableRows}
              summary={summary}
              hasAnomaly={hasAnomaly}
              loading={loading}
            />
          </>
        ) : (
          <RekapPerRuangan
            rows={roomRows}
            loading={roomLoading}
            error={roomError}
            selectedYear={selectedYear}
            selectedMonth={roomMonth}
            availableYears={availableYears}
            onYearChange={setSelectedYear}
            onMonthChange={setRoomMonth}
            onRetry={loadRoomData}
          />
        )}
      </div>
    </AppLayout>
  );
}
