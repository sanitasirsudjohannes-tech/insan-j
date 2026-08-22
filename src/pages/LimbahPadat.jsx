import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { getCurrentUser, getSetting, getSettingCached } from '../lib/api';
import { saveToOfflineQueue, getUnsyncedItemsForTable, removeLocalRecordQueue, getOfflineDeletedIds } from '../lib/offlineStorage';
import * as XLSX from 'xlsx';

import PadatForm, { EMPTY_FORM } from '../components/limbah/padat/PadatForm';
import PadatImportExportToolbar from '../components/limbah/padat/PadatImportExportToolbar';
import PadatTable from '../components/limbah/padat/PadatTable';
import OfflineBanner from '../components/limbah/OfflineBanner';
import Pagination from '../components/limbah/Pagination';
import { buildPadatPrintHTML } from '../components/limbah/padat/padatPrintTemplate';
import { printViaHiddenIframe } from '../lib/printHelpers';
import { formatDateFromExcel } from '../lib/excelDateHelpers';

const MySwal = withReactContent(Swal);

function EmbeddedWrapper({ children }) { return <div className="bg-gray-100 min-h-screen">{children}</div>; }
function FullWrapper({ children }) { return <AppLayout title="Limbah Padat">{children}</AppLayout>; }

const ITEMS_PER_PAGE = 10;

export default function LimbahPadat({ embedded = false }) {
  const user = getCurrentUser();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const [filterMonth, setFilterMonth] = useState('');
  const [formEnabled, setFormEnabled] = useState(() => getSettingCached('form_limbah_padat_enabled', true));
  const [formData, setFormData] = useState(EMPTY_FORM);
  const importInputRef = useRef(null);
  const printFrameRef = useRef(null);
  const fetchIdRef = useRef(0);

  // ── Akumulasi data (padat + ruangan) ─────────────────────────────────────────
  const getAccumulatedData = async (targetMonth = null) => {
    let dbPadat = [], dbRuangan = [];
    if (navigator.onLine) {
      try {
        let qP = supabase.from('limbah_padat').select('id, tanggal, infeksius, jarum_suntik, botol_obat, sitotoksik, petugas, waktu_input');
        let qR = supabase.from('limbah_ruangan').select('id, tanggal, ruangan, infeksius, jarum_suntik, botol_obat, sitotoksik, petugas, waktu_input');
        if (targetMonth) {
          const [y, m] = targetMonth.split('-');
          const s = `${y}-${m}-01`;
          const e = `${y}-${m}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
          qP = qP.gte('tanggal', s).lte('tanggal', e);
          qR = qR.gte('tanggal', s).lte('tanggal', e);
        }
        const [{ data: pD, error: pError }, { data: rD, error: rError }] = await Promise.all([qP, qR]);
        if (pError) throw pError;
        if (rError) throw rError;
        dbPadat = pD || []; dbRuangan = rD || [];
      } catch (err) {
        console.warn('Network issue fetching accumulated data:', err);
        throw err;
      }
    }

    let unsyncedP = getUnsyncedItemsForTable('limbah_padat');
    let unsyncedR = getUnsyncedItemsForTable('limbah_ruangan');
    if (targetMonth) {
      unsyncedP = unsyncedP.filter(i => i.tanggal?.startsWith(targetMonth));
      unsyncedR = unsyncedR.filter(i => i.tanggal?.startsWith(targetMonth));
    }
    const pIds = new Set(unsyncedP.map(u => String(u.id)));
    const rIds = new Set(unsyncedR.map(u => String(u.id)));

    const delPIds = new Set(getOfflineDeletedIds('limbah_padat'));
    const delRIds = new Set(getOfflineDeletedIds('limbah_ruangan'));

    const allPadat = [...unsyncedP, ...dbPadat.filter(d => !pIds.has(String(d.id)) && !delPIds.has(String(d.id)))];
    const allRuangan = [...unsyncedR, ...dbRuangan.filter(d => !rIds.has(String(d.id)) && !delRIds.has(String(d.id)))];

    const dateMap = new Map();
    allRuangan.forEach(item => {
      const tgl = item.tanggal; if (!tgl) return;
      if (!dateMap.has(tgl)) dateMap.set(tgl, { id: `agg_${tgl}`, tanggal: tgl, infeksius: 0, jarum_suntik: 0, botol_obat: 0, sitotoksik: 0, ruanganCount: 0, ruanganNames: new Set(), padatIds: [], isOffline: false, isRoomAccumulation: true, isManual: false });
      const e = dateMap.get(tgl);
      e.infeksius += parseFloat(item.infeksius || 0); e.jarum_suntik += parseFloat(item.jarum_suntik || 0);
      e.botol_obat += parseFloat(item.botol_obat || 0); e.sitotoksik += parseFloat(item.sitotoksik || 0);
      e.ruanganCount += 1; if (item.ruangan) e.ruanganNames.add(item.ruangan);
      if (item.isOffline) e.isOffline = true;
    });
    allPadat.forEach(item => {
      const tgl = item.tanggal; if (!tgl) return;
      if (!dateMap.has(tgl)) dateMap.set(tgl, { id: item.id || `padat_${tgl}`, tanggal: tgl, infeksius: 0, jarum_suntik: 0, botol_obat: 0, sitotoksik: 0, ruanganCount: 0, ruanganNames: new Set(), padatIds: [], isOffline: false, isManual: true });
      const e = dateMap.get(tgl);
      e.infeksius += parseFloat(item.infeksius || 0); e.jarum_suntik += parseFloat(item.jarum_suntik || 0);
      e.botol_obat += parseFloat(item.botol_obat || 0); e.sitotoksik += parseFloat(item.sitotoksik || 0);
      e.isManual = true;
      if (item.id && !e.padatIds.includes(item.id)) e.padatIds.push(item.id);
      if (item.isOffline) e.isOffline = true;
    });
    return Array.from(dateMap.values());
  };

  // ── fetchData ─────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);
    try {
      const accumulated = await getAccumulatedData(filterMonth);
      if (currentFetchId !== fetchIdRef.current) return;
      accumulated.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      setTotalData(accumulated.length);
      const from = (page - 1) * ITEMS_PER_PAGE;
      setData(accumulated.slice(from, from + ITEMS_PER_PAGE));
    } catch (err) { 
      console.error('Error fetching accumulated data:', err); 
    }
    finally { 
      if (currentFetchId === fetchIdRef.current) setLoading(false); 
    }
  };

  useEffect(() => {
    fetchData();
    const h = () => fetchData();
    window.addEventListener('offline-queue-changed', h);
    window.addEventListener('online', h);
    window.addEventListener('offline', h);
    
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        h();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED'].includes(event)) {
        h();
      }
    });

    return () => { 
      window.removeEventListener('offline-queue-changed', h); 
      window.removeEventListener('online', h); 
      window.removeEventListener('offline', h); 
      document.removeEventListener('visibilitychange', handleVisibility);
      subscription?.unsubscribe();
    };
  }, [page, filterMonth]);

  useEffect(() => {
    getSetting('form_limbah_padat_enabled', true).then(setFormEnabled);
    const onSetting = (e) => { if (e.detail?.key === 'form_limbah_padat_enabled') setFormEnabled(e.detail.value); };
    window.addEventListener('app-setting-changed', onSetting);
    return () => window.removeEventListener('app-setting-changed', onSetting);
  }, []);

  useEffect(() => {
    return () => { if (printFrameRef.current?.parentNode) printFrameRef.current.parentNode.removeChild(printFrameRef.current); };
  }, []);

  // ── Handlers form ─────────────────────────────────────────────────────────────
  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true);
    const payload = { tanggal: formData.tanggal, petugas: user?.nama || 'Petugas', infeksius: parseFloat(formData.infeksius) || 0, jarum_suntik: parseFloat(formData.jarum_suntik) || 0, botol_obat: parseFloat(formData.botol_obat) || 0, sitotoksik: parseFloat(formData.sitotoksik) || 0, waktu_input: new Date().toISOString() };
    try {
      if (!navigator.onLine) {
        saveToOfflineQueue('limbah_padat', formData.id ? 'update' : 'insert', formData.id ? { ...payload, id: formData.id } : payload, 'Input Limbah Padat');
        MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: 'Data tersimpan di HP dan akan dikirim otomatis saat online.', confirmButtonColor: '#059669' });
      } else if (formData.id) {
        const { error } = await supabase.from('limbah_padat').update(payload).eq('id', formData.id);
        if (error) throw error;
        MySwal.fire('Berhasil', 'Data berhasil diubah', 'success');
      } else {
        const { error } = await supabase.from('limbah_padat').insert([payload]);
        if (error) throw error;
        MySwal.fire('Berhasil', 'Data berhasil ditambahkan', 'success');
      }
      setFormData(EMPTY_FORM); fetchData();
    } catch (error) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
        saveToOfflineQueue('limbah_padat', formData.id ? 'update' : 'insert', formData.id ? { ...payload, id: formData.id } : payload, 'Input Limbah Padat');
        MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: 'Jaringan terputus. Data tersimpan di HP.', confirmButtonColor: '#059669' });
        setFormData(EMPTY_FORM);
      } else { MySwal.fire('Gagal', error.message, 'error'); }
    } finally { setSubmitting(false); }
  };

  const handleEdit = (item) => {
    if (item.isRoomAccumulation && !item.isManual) {
      const rooms = Array.from(item.ruanganNames || []);
      MySwal.fire({ icon: 'info', title: 'Akumulasi Data Ruangan', html: `Data ini merupakan akumulasi otomatis dari <strong>${item.ruanganCount} ruangan</strong>:<br><br><div class="text-left bg-gray-100 p-3 rounded-lg text-xs max-h-40 overflow-y-auto font-mono">${rooms.map(r => `• ${r}`).join('<br>')}</div><br><span class="text-xs text-gray-500">Untuk mengedit, gunakan menu <strong>Limbah Per Ruangan</strong>.</span>`, confirmButtonColor: '#059669' });
      return;
    }
    setFormData({ id: item.id, tanggal: item.tanggal, infeksius: item.infeksius, jarum_suntik: item.jarum_suntik, botol_obat: item.botol_obat, sitotoksik: item.sitotoksik });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (item) => {
    if (item.isRoomAccumulation && !item.isManual) {
      MySwal.fire({ icon: 'info', title: 'Tidak Bisa Dihapus Langsung', text: 'Data ini akumulasi otomatis dari Limbah Per Ruangan. Hapus melalui menu "Limbah Per Ruangan".', confirmButtonColor: '#059669' });
      return;
    }
    const isMixed = item.isRoomAccumulation && item.isManual;
    const idsToDelete = isMixed ? (item.padatIds || []) : [item.id];
    if (isMixed && idsToDelete.length === 0) { MySwal.fire({ icon: 'warning', title: 'Tidak ada data manual', text: 'Data ruangan harus dihapus dari menu Limbah Per Ruangan.', confirmButtonColor: '#059669' }); return; }
    const tglLabel = new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const { isConfirmed } = await MySwal.fire({ title: 'Hapus Data?', text: isMixed ? `Hanya data manual pada ${tglLabel} yang dihapus.` : `Data ${tglLabel} akan dihapus permanen!`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Ya, Hapus!' });
    if (!isConfirmed) return;
    try {
      for (const id of idsToDelete) {
        removeLocalRecordQueue({ id: String(id) });
        if (String(id).startsWith('off_')) continue;
        if (!navigator.onLine) { saveToOfflineQueue('limbah_padat', 'delete', { id }, `Hapus Limbah Padat ${item.tanggal}`); continue; }
        const { error } = await supabase.from('limbah_padat').delete().eq('id', id);
        if (error) throw error;
      }
      MySwal.fire('Terhapus', navigator.onLine ? (isMixed ? 'Data manual berhasil dihapus.' : 'Data berhasil dihapus.') : 'Perintah hapus disimpan offline.', 'success');
      fetchData();
    } catch (error) {
      if (!navigator.onLine || error.message?.includes('Failed to fetch') || error.message?.includes('network')) { MySwal.fire({ icon: 'info', title: 'Tersimpan Offline', text: 'Perintah hapus disimpan dan akan diproses otomatis.', confirmButtonColor: '#059669' }); fetchData(); }
      else { MySwal.fire('Gagal', error.message, 'error'); }
    }
  };

  // ── Export Excel ──────────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    const { value: selectedMonth } = await MySwal.fire({ title: 'Export Data Limbah', html: `<div class="text-left mt-4"><label class="block text-sm font-bold text-gray-700 mb-1.5">Bulan & Tahun</label><input id="swal-input-month" type="month" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50" value="${filterMonth || new Date().toISOString().slice(0, 7)}"></div>`, focusConfirm: false, showCancelButton: true, confirmButtonText: '<i class="fas fa-file-excel mr-2"></i>Export', cancelButtonText: 'Batal', confirmButtonColor: '#059669', preConfirm: () => document.getElementById('swal-input-month').value });
    if (!selectedMonth) return;
    MySwal.fire({ title: 'Mengambil Data...', allowOutsideClick: false, didOpen: () => MySwal.showLoading() });
    try {
      const exportData = await getAccumulatedData(selectedMonth);
      exportData.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      if (!exportData.length) { MySwal.fire('Informasi', 'Tidak ada data untuk bulan ini.', 'info'); return; }
      const [year, month] = selectedMonth.split('-');
      const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      const monthLabel = `${monthNames[parseInt(month)-1]} ${year}`;
      const wsData = [['LAPORAN LIMBAH MEDIS PADAT (AKUMULASI HARIAN)'],[`Periode: ${monthLabel}`],[`Dicetak: ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}`],[],['No.','Tanggal','Limbah Infeksius (Kg)','Jarum Suntik (Kg)','Botol Obat (Kg)','Sitotoksik (Kg)','Total Harian (Kg)','Keterangan Sumber']];
      let tI=0,tJ=0,tB=0,tS=0;
      exportData.forEach((item,idx)=>{ const inf=parseFloat(item.infeksius)||0,jar=parseFloat(item.jarum_suntik)||0,bot=parseFloat(item.botol_obat)||0,sit=parseFloat(item.sitotoksik)||0,tot=inf+jar+bot+sit; tI+=inf;tJ+=jar;tB+=bot;tS+=sit; const src=[]; if(item.ruanganCount>0) src.push(`Akumulasi ${item.ruanganCount} ruangan`); if(item.isManual) src.push('Input Manual'); wsData.push([idx+1,new Date(item.tanggal).toLocaleDateString('id-ID'),inf,jar,bot,sit,tot,src.join(' & ')]); });
      wsData.push([],['TOTAL BULANAN','',tI,tJ,tB,tS,tI+tJ+tB+tS]);
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols']=[{wch:5},{wch:14},{wch:22},{wch:18},{wch:16},{wch:14},{wch:18}];
      ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:6}},{s:{r:1,c:0},e:{r:1,c:6}},{s:{r:2,c:0},e:{r:2,c:6}}];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,`Limbah ${monthLabel}`);
      XLSX.writeFile(wb,`Laporan_Limbah_Padat_${monthLabel.replace(' ','_')}.xlsx`);
      MySwal.fire({ icon:'success', title:'Export Berhasil!', text:`${exportData.length} data berhasil diekspor.`, timer:2000, showConfirmButton:false });
    } catch (error) { MySwal.fire('Gagal','Terjadi kesalahan: '+error.message,'error'); }
  };

  // ── Download Template ─────────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([['No.','Tanggal','Limbah Infeksius (Kg)','Jarum Suntik (Kg)','Botol Obat (Kg)','Sitotoksik (Kg)'],['','Petunjuk: Isi tanggal format DD-MM-YYYY, misal: 15-01-2025','','','',''],[1,'01-01-2025',0.5,0.2,0.1,0.05],[2,'02-01-2025',0.8,0.3,0.15,0.1]]);
    ws['!cols']=[{wch:5},{wch:20},{wch:22},{wch:18},{wch:16},{wch:14}];
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Template'); XLSX.writeFile(wb,'Template_Import_Limbah_Padat.xlsx');
  };

  // ── Import Excel ──────────────────────────────────────────────────────────────
  const handleImportFile = (e) => {
    const file = e.target.files[0]; if (!file) return; e.target.value='';
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type:'binary', cellDates:false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        let headerIdx=-1;
        for(let i=0;i<rows.length;i++){ if(rows[i].join('').toLowerCase().includes('tanggal')){ headerIdx=i; break; } }
        if(headerIdx===-1){ MySwal.fire('Format Salah','Tidak ditemukan header "Tanggal". Gunakan template yang tersedia.','error'); return; }
        const dataRows = rows.slice(headerIdx+1).filter(r=>{ const t=r[1]; return t&&String(t).trim()!==''&&!String(t).toLowerCase().includes('petunjuk')&&!String(t).toLowerCase().includes('total'); });
        if(!dataRows.length){ MySwal.fire('Tidak Ada Data','Tidak ditemukan baris data yang valid.','warning'); return; }
        const { isConfirmed } = await MySwal.fire({ title:'Konfirmasi Import', html:`<p>Ditemukan <strong>${dataRows.length} baris data</strong>. Lanjutkan import?</p>`, icon:'question', showCancelButton:true, confirmButtonColor:'#16a34a', confirmButtonText:'Ya, Import!' });
        if(!isConfirmed) return;
        setImporting(true); MySwal.fire({ title:'Mengimport Data...', allowOutsideClick:false, didOpen:()=>MySwal.showLoading() });
        const payloads = dataRows.map(r=>({ tanggal:formatDateFromExcel(r[1]), petugas:user?.nama||'Petugas', infeksius:parseFloat(r[2])||0, jarum_suntik:parseFloat(r[3])||0, botol_obat:parseFloat(r[4])||0, sitotoksik:parseFloat(r[5])||0, waktu_input:new Date().toISOString() })).filter(p=>p.tanggal);
        if(!payloads.length){ MySwal.fire('Gagal','Tidak ada baris dengan tanggal yang valid.','error'); setImporting(false); return; }
        let inserted=0;
        for(let i=0;i<payloads.length;i+=50){ const batch=payloads.slice(i,i+50); const {error}=await supabase.from('limbah_padat').insert(batch); if(error) throw error; inserted+=batch.length; }
        await fetchData(); MySwal.fire({ icon:'success', title:'Import Berhasil!', text:`${inserted} data berhasil diimport.`, timer:2500, showConfirmButton:false });
      } catch(err){ MySwal.fire('Gagal Import',err.message||'Terjadi kesalahan saat membaca file.','error'); }
      finally{ setImporting(false); }
    };
    reader.readAsBinaryString(file);
  };

  // ── Print ─────────────────────────────────────────────────────────────────────
  const handlePrint = async () => {
    const { value: formValues } = await MySwal.fire({ title:'Cetak Laporan', html:`<div class="text-left mt-4"><label class="block text-sm font-bold text-gray-700 mb-1.5">Bulan & Tahun</label><input id="swal-input-month" type="month" class="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50" value="${filterMonth||new Date().toISOString().slice(0,7)}"></div>`, focusConfirm:false, showCancelButton:true, confirmButtonText:'<i class="fas fa-print mr-2"></i>Cetak', cancelButtonText:'Batal', confirmButtonColor:'#2563eb', preConfirm:()=>{ const i=document.getElementById('swal-input-month'); return i?i.value:''; } });
    if(!formValues) return;
    MySwal.fire({ title:'Menyiapkan Laporan...', text:'Mohon tunggu sebentar', allowOutsideClick:false, allowEscapeKey:false, didOpen:()=>MySwal.showLoading() });
    try {
      const printData = await getAccumulatedData(formValues);
      printData.sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
      if(!printData.length){ MySwal.fire({ icon:'info', title:'Tidak Ada Data', text:'Tidak ada data limbah untuk bulan yang dipilih.', confirmButtonColor:'#2563eb' }); return; }
      const html = buildPadatPrintHTML(printData, formValues);
      MySwal.close();
      const success = await printViaHiddenIframe(html, printFrameRef);
      if(!success) MySwal.fire({ icon:'error', title:'Gagal Membuka Cetakan', text:'Browser tidak mendukung cetak langsung. Coba Chrome/Safari terbaru.', confirmButtonColor:'#2563eb' });
    } catch(error){ MySwal.fire({ icon:'error', title:'Gagal', text:'Terjadi kesalahan saat mengambil data cetak: '+(error.message||error), confirmButtonColor:'#dc2626' }); }
  };

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
          <OfflineBanner data={data} />
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