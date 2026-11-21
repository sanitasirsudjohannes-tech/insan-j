import AppLayout from '../components/AppLayout';
import WaterExaminationForm from '../features/pemeriksaan-air/components/WaterExaminationForm';
import WaterRecordsSection from '../features/pemeriksaan-air/components/WaterRecordsSection';
import { useWaterExaminations } from '../features/pemeriksaan-air/hooks/useWaterExaminations';

export default function PemeriksaanAir() {
  const water = useWaterExaminations();
  const { choosingType, setChoosingType } = water;

  return <AppLayout title="Pemeriksaan Air">
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <section className="overflow-hidden rounded-3xl bg-linear-to-br from-cyan-600 via-blue-600 to-indigo-700 p-5 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">Pemantauan Kualitas Lingkungan</p>
            <h2 className="mt-1 text-2xl font-black">Air Bersih & Air Limbah</h2>
            <p className="mt-1 text-sm text-blue-100">Simpan hasil laboratorium per lokasi, inlet, dan outlet.</p>
          </div>
        </div>
      </section>

      {!water.showForm && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Input Pemeriksaan</h2>
            <p className="mt-1 text-xs text-slate-500">Tambahkan hasil laboratorium air bersih atau air limbah.</p>
          </div>
          <button
            type="button"
            disabled={water.masterLoading}
            aria-expanded={choosingType}
            aria-controls="water-input-options"
            onClick={() => setChoosingType(current => !current)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            <i aria-hidden="true" className="fas fa-plus" />
            {water.masterLoading ? 'Memuat pengaturan...' : 'Tambah Pemeriksaan'}
          </button>
        </div>
        <div id="water-input-options" hidden={!choosingType} className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { type: 'clean', label: 'Air Bersih', detail: 'Input hasil pemeriksaan per lokasi atau bak.', icon: 'fa-droplet', color: 'border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100' },
              { type: 'wastewater', label: 'Air Limbah', detail: 'Input hasil pemeriksaan inlet dan outlet IPAL.', icon: 'fa-water', color: 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100' },
            ].map(option => <button
              key={option.type}
              type="button"
              disabled={water.masterLoading}
              onClick={() => {
                if (water.openNew(option.type)) setChoosingType(false);
              }}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ${option.color}`}
            >
              <i aria-hidden="true" className={`fas ${option.icon} text-xl`} />
              <span><span className="block text-sm font-bold">{option.label}</span><span className="mt-1 block text-xs">{option.detail}</span></span>
              <i aria-hidden="true" className="fas fa-chevron-right ml-auto text-xs" />
            </button>)}
          </div>
        </div>
      </section>}

      {water.showForm && <WaterExaminationForm
        form={water.form} saving={water.saving} tableGenerated={water.tableGenerated}
        cleanRows={water.cleanRows} wastewaterRows={water.wastewaterRows}
        onChange={water.changeField} onGenerate={water.generateTable}
        onResultChange={water.updateResult} onSubmit={water.submit}
        onClose={() => water.setShowForm(false)}
      />}

      <WaterRecordsSection
        monthGroups={water.monthGroups} dateGroupsByType={water.dateGroupsByType} records={water.detailRecords}
        month={water.month} waterType={water.typeFilter} selectedDate={water.selectedDate}
        loading={water.loading} indexLoading={water.masterLoading}
        onSelectMonth={water.selectMonth} onSelectDate={water.selectDate}
        onBackToDates={() => water.setSelectedDate('')} onRefresh={water.refreshArchive}
        onEdit={water.editRecord} onRemove={water.removeRecord}
      />
    </div>
  </AppLayout>;
}
