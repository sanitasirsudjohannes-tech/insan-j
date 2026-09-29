import { useEffect, useState } from 'react';

const hourFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Makassar', hour: '2-digit', hourCycle: 'h23' });
const dateFormatter = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function greetingAt(date) {
  const hour = Number(hourFormatter.format(date));
  if (hour >= 5 && hour < 11) return { title: 'Selamat pagi', emoji: '🌤️', message: 'Semangat memulai hari! Mari jaga kebersihan lingkungan rumah sakit bersama.' };
  if (hour >= 11 && hour < 15) return { title: 'Selamat siang', emoji: '☀️', message: 'Semoga aktivitas hari ini lancar. Terima kasih sudah mencatat dengan teliti.' };
  if (hour >= 15 && hour < 18) return { title: 'Selamat sore', emoji: '🌇', message: 'Terima kasih atas kerja hari ini. Mari periksa kembali catatan yang sudah dibuat.' };
  return { title: 'Selamat malam', emoji: '🌙', message: 'Semoga aktivitas malam ini berjalan lancar. Tetap jaga kesehatan dan keselamatan.' };
}

export default function WelcomeBanner({ user, student = false }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'hidden') setNow(new Date());
    };
    const timer = window.setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const greeting = greetingAt(now);
  const name = user?.nama?.trim() || (student ? 'Teman Praktik' : 'Petugas');
  return (
    <section className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm md:flex-row md:items-center md:p-8">
      <div className="min-w-0">
        {student && <span className="mb-3 inline-flex rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-700">MAHASISWA PRAKTIK</span>}
        <h2 className="break-words text-2xl font-extrabold text-gray-800">{greeting.title}, {name}! <span aria-hidden="true">{greeting.emoji}</span></h2>
        <p className="mt-2 font-medium text-gray-500">{greeting.message}</p>
        {student && <p className="mt-2 text-sm text-gray-500">Anda dapat mencatat dan mengelola data limbah per ruangan serta limbah anorganik yang Anda input sendiri.</p>}
      </div>
      <div className="flex max-w-full shrink-0 items-center gap-2 self-start rounded-lg bg-blue-50 px-4 py-2 text-sm font-bold text-blue-600 md:max-w-xs">
        <i aria-hidden="true" className="fas fa-calendar-day" />
        <span>{dateFormatter.format(now)}<span className="block text-xs font-medium text-blue-500">Waktu Indonesia Tengah (WITA)</span></span>
      </div>
    </section>
  );
}
