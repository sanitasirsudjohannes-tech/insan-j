import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AppLayout from '../AppLayout';
import { getWitaMonthString } from '../../lib/localDate';
import useAdminOverview from './admin/useAdminOverview';
import styles from './admin/AdminOverview.module.css';

const number = value => value == null ? '—' : Number(value).toLocaleString('id-ID', { maximumFractionDigits: 2 });
const date = value => value ? new Date(value.slice(0, 10) + 'T00:00:00+08:00').toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'long', year: 'numeric' }) : 'Belum tersedia';
const monthLabel = value => new Date(value + '-01T00:00:00+08:00').toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', month: 'long', year: 'numeric' });
const timestamp = value => value ? new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', dateStyle: 'medium', timeStyle: 'short' }) + ' WITA' : '—';

function Source({ response }) {
  return <p className={styles.muted}>{response?.source === 'offline' ? 'Salinan offline' : 'Data yang diterima server'} · Diperbarui {timestamp(response?.updatedAt)}</p>;
}

function Metric({ label, value, note }) {
  return <article className={styles.card}><p className={styles.muted}>{label}</p><p className={styles.value}>{value}</p><p className={styles.muted}>{note}</p></article>;
}

function WasteOverview({ result, month }) {
  const [table, setTable] = useState(false);
  const summary = result.waste?.data?.annualSummary;
  const rows = (result.waste?.data?.daily || []).map(row => ({ ...row, masuk: Number(row.masuk) || 0, diangkut: Number(row.diangkut) || 0, day: row.tanggal.slice(8, 10) }));
  const totals = rows.reduce((sum, row) => ({ masuk: sum.masuk + row.masuk, diangkut: sum.diangkut + row.diangkut }), { masuk: 0, diangkut: 0 });
  return <div className={styles.stack}>
    {result.wasteError ? <p className={styles.notice} role="alert">{result.wasteError}</p> : <>
      <div>
        <p className={styles.eyebrow}>Limbah medis · Ringkasan tahun {summary?.year || 'berjalan'}</p>
        <p className={styles.muted}>Akumulasi 1 Januari sampai {date(summary?.asOfDate)}. Pilihan bulan di atas mengatur grafik dan inspeksi.</p>
        <div className={styles.cards}>
          <Metric label="Timbulan" value={number(summary?.masuk) + ' kg'} note="Limbah masuk tahun berjalan" />
          <Metric label="Diangkut" value={number(summary?.diangkut) + ' kg'} note="Pengangkutan tahun berjalan" />
          <Metric label="Sisa tercatat" value={number(summary?.sisa) + ' kg'} note={'Per ' + date(summary?.asOfDate)} />
        </div>
        {!summary && <p className={styles.notice}>Ringkasan tahunan belum tersedia.</p>}
        {summary && <details className={styles.panel}>
          <summary className="cursor-pointer text-sm font-semibold">Lihat perhitungan sisa</summary>
          <p className="mt-3 text-sm leading-7">{number(summary.opening)} kg sisa awal + {number(summary.masuk)} kg timbulan − {number(summary.diangkut)} kg pengangkutan = <strong>{number(summary.sisa)} kg</strong>.</p>
          {Number(summary.sisa) < 0 && <p className={styles.notice}>Sisa tercatat negatif. Tinjau kelengkapan timbulan, saldo awal, dan pengangkutan.</p>}
        </details>}
      </div>
      <section className={styles.panel}>
        <div className={styles.row}>
          <div><h2 className={styles.heading}>Timbulan & pengangkutan</h2><p className={styles.muted}>{monthLabel(month)} · kilogram</p></div>
          <button className={styles.button} type="button" aria-pressed={table} onClick={() => setTable(value => !value)}>{table ? 'Tampilkan grafik' : 'Tampilkan tabel'}</button>
        </div>
        <p className="my-4 text-sm text-slate-600">Timbulan bulan ini <strong>{number(totals.masuk)} kg</strong> · Diangkut <strong>{number(totals.diangkut)} kg</strong></p>
        {!rows.length ? <p className="py-16 text-center text-sm text-slate-500">Belum ada data pada bulan ini.</p> : table ?
          <div className="max-h-80 overflow-auto"><table className={styles.table}><caption className="sr-only">Rincian limbah {monthLabel(month)}</caption><thead><tr><th>Tanggal</th><th>Timbulan (kg)</th><th>Diangkut (kg)</th></tr></thead><tbody>{rows.map(row => <tr key={row.tanggal}><td>{date(row.tanggal)}</td><td>{number(row.masuk)}</td><td>{number(row.diangkut)}</td></tr>)}</tbody></table></div> :
          <div className="mt-6 h-72 min-w-0"><ResponsiveContainer width="100%" height="100%" minWidth={1}>
            <BarChart data={rows} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid vertical={false} stroke="#edf1f4" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><YAxis width={55} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(_, payload) => date(payload?.[0]?.payload?.tanggal)} formatter={(value, name) => [number(value) + ' kg', name]} />
              <Bar dataKey="masuk" name="Timbulan" fill="#0f766e" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="diangkut" name="Diangkut" fill="#94a3b8" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer><p className="text-center text-xs text-slate-500">Hijau: timbulan · Abu-abu: diangkut · Sentuh batang untuk melihat nilai</p></div>}
        <div className="mt-5"><Source response={result.waste} /></div>
      </section>
    </>}
    <section className={styles.panel}>
      <div className={styles.row}><h2 className={styles.heading}>Pencatatan terbaru</h2><span className={styles.badge}>Medis per ruangan & anorganik</span></div>
      <p className={styles.muted}>Lima catatan terakhir lintas periode. Tidak menunjukkan kewajiban pencatatan ruangan.</p>
      {result.activityError ? <p className="mt-4 text-sm text-amber-700">{result.activityError}</p> : !result.activities.length ? <p className="py-8 text-sm text-slate-500">Belum ada catatan.</p> :
      <ul className="mt-4 divide-y divide-slate-100">{result.activities.map(row => <li key={row.key} className="flex flex-col justify-between gap-1 py-4 sm:flex-row">
        <div><p className="text-sm font-semibold">{row.ruangan || 'Ruangan tidak tercantum'}</p><p className={styles.muted}>{row.label} · {row.petugas || 'Petugas'}</p></div>
        <div className="text-xs leading-6 text-slate-500 sm:text-right"><p>Data {date(row.tanggal)}</p><p>Dicatat {timestamp(row.waktu_input)}</p></div>
      </li>)}</ul>}
    </section>
  </div>;
}

function Inspections({ response }) {
  const data = response.data;
  const total = Number(data.totalInspeksi) || 0;
  return <div className={styles.stack}>
    <div className="grid gap-4 sm:grid-cols-2"><Metric label="Inspeksi tercatat" value={number(total)} note="Pada bulan yang dipilih" /><Metric label="Rata-rata hasil inspeksi" value={total ? number(Number(data.totalPersen) / total) + '%' : '—'} note="Berdasarkan inspeksi yang sudah tercatat" /></div>
    <section className={styles.panel}><h2 className={styles.heading}>Hasil per kategori</h2><p className={styles.muted}>Rata-rata nilai hasil inspeksi, bukan persentase ruangan yang wajib mencatat.</p>
      <div className="mt-6 space-y-6">{(data.categories || []).map(row => {
        const count = Number(row.jumlah) || 0;
        const value = count ? Number(row.total) / count : 0;
        return <div key={row.label}><div className={styles.row}><span className="text-sm font-medium">{row.label}</span><span className={styles.muted}>{count} inspeksi · {count ? number(value) + '%' : 'Belum ada data'}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: Math.min(100, Math.max(0, value)) + '%' }} /></div></div>;
      })}</div><div className="mt-8"><Source response={response} /></div>
    </section>
  </div>;
}

function Water({ response }) {
  return <div className={styles.stack}><p className={styles.muted}>Pemeriksaan terakhir masing-masing jenis air; tidak mengikuti filter bulan. Hasil ini adalah kondisi pada tanggal sampling.</p>
    {response.data.map(group => {
      const failed = group.rows.filter(row => row.parameters?.some(item => item.status === 'tidak_memenuhi')).length;
      const pending = group.rows.filter(row => !row.parameters?.length || row.parameters.some(item => !['memenuhi', 'tidak_memenuhi'].includes(item.status))).length;
      return <section key={group.type} className={styles.panel}>
        <div className={styles.row}><h2 className={styles.heading}>{group.type === 'clean' ? 'Air Bersih' : 'Air Limbah'}</h2><span className={styles.badge}>{date(group.date)}</span></div>
        {!group.date ? <p className="mt-4 text-sm text-slate-500">Belum ada pemeriksaan.</p> : <>
          <p className="my-4 text-sm">{group.rows.length} titik pemeriksaan · <span className={failed ? 'text-amber-700' : 'text-teal-700'}>{failed} titik dengan hasil tidak memenuhi</span> · {pending} titik belum lengkap penilaiannya</p>
          <details><summary className="cursor-pointer text-sm font-semibold">Lihat hasil per titik</summary><ul className="mt-3 divide-y divide-slate-100">{group.rows.map(row => <li key={row.id} className="py-3"><p className="text-sm font-semibold">{row.water_clean_locations?.name || row.sample_point || 'Lokasi tidak tercantum'}</p>{(row.parameters || []).map((item, index) => <p key={index} className="mt-1 text-xs text-slate-600">{item.parameter}: {item.result} {item.unit} · {item.status === 'tidak_memenuhi' ? 'Tidak memenuhi' : item.status === 'memenuhi' ? 'Memenuhi' : 'Belum dinilai'}</p>)}</li>)}</ul></details>
        </>}
      </section>;
    })}<Source response={response} />
  </div>;
}

export default function DashboardAdmin({ user }) {
  const waterEnabled = true;
  const [section, setSection] = useState('limbah');
  const [month, setMonth] = useState(getWitaMonthString);
  const { data, loading, error, refresh } = useAdminOverview(section, month);
  const sections = [['limbah', 'Ringkasan limbah'], ['inspeksi', 'Inspeksi sanitasi'], ...(waterEnabled ? [['air', 'Pemeriksaan air']] : [])];
  return <AppLayout title="Dashboard Admin"><div className={styles.shell}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>INSAN-J / Administrasi</p><h1 className={styles.title}>Pantau lingkungan rumah sakit.</h1><p className={styles.muted}>Selamat datang, {user?.nama || 'Admin'}. Ringkasan untuk membantu pemantauan dan tindak lanjut.</p></div>
      <div className={styles.links}><Link className={styles.button} to="/kelola-admin">Kelola data & akun</Link><Link className={styles.button} to="/rekap-limbah">Buka rekap</Link></div>
    </header>
    <div className={styles.toolbar}>
      <div className={styles.tabs} role="group" aria-label="Tampilan dashboard admin">{sections.map(([id, label]) => <button key={id} type="button" aria-pressed={section === id} onClick={() => setSection(id)} className={styles.tab + ' ' + (section === id ? styles.active : '')}>{label}</button>)}</div>
      <div className="flex flex-wrap items-center gap-2">
        {section !== 'air' && <label className="text-xs text-slate-500">Periode<input aria-label="Bulan grafik dan inspeksi" type="month" value={month} onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) setMonth(event.target.value); }} className="ml-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" /></label>}
        <button type="button" className={styles.button} disabled={loading} onClick={refresh}>{loading ? 'Memuat…' : 'Segarkan'}</button>
      </div>
    </div>
    {loading ? <div role="status" className={styles.panel}><p className={styles.muted}>Memuat ringkasan…</p><div className="mt-5 h-40 rounded-xl bg-slate-50" /></div> : error ? <div role="alert" className={styles.panel}><p className={styles.notice}>{error}</p><button type="button" className={styles.button + ' mt-4'} onClick={refresh}>Coba lagi</button></div> :
      <div key={section + month} className={styles.reveal}>{section === 'limbah' ? <WasteOverview result={data} month={month} /> : section === 'inspeksi' ? <Inspections response={data} /> : <Water response={data} />}</div>}
  </div></AppLayout>;
}
