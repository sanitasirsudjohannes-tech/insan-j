import AppLayout from '../components/AppLayout';
import WaterExaminationForm from '../features/pemeriksaan-air/components/WaterExaminationForm';
import WaterRecordsSection from '../features/pemeriksaan-air/components/WaterRecordsSection';
import { useWaterExaminations } from '../features/pemeriksaan-air/hooks/useWaterExaminations';

export default function PemeriksaanAir() {
  const water = useWaterExaminations();

  return <AppLayout title="Pemeriksaan Air">
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <section className="overflow-hidden rounded-3xl bg-linear-to-br from-cyan-600 via-blue-600 to-indigo-700 p-5 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">Pemantauan Kualitas Lingkungan</p>
            <h2 className="mt-1 text-2xl font-black">Air Bersih & Air Limbah</h2>
            <p className="mt-1 text-sm text-blue-100">Simpan hasil laboratorium per lokasi, inlet, dan outlet.</p>
          </div>
          <div className="flex gap-2">
            <button disabled={water.masterLoading} onClick={() => water.openNew('clean')} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-700 shadow disabled:cursor-wait disabled:opacity-60">{water.masterLoading ? 'Memuat...' : '+ Air Bersih'}</button>
            <button disabled={water.masterLoading} onClick={() => water.openNew('wastewater')} className="rounded-xl border border-white/40 bg-white/15 px-3 py-2 text-xs font-bold text-white backdrop-blur disabled:cursor-wait disabled:opacity-60">{water.masterLoading ? 'Memuat...' : '+ Air Limbah'}</button>
          </div>
        </div>
      </section>

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
