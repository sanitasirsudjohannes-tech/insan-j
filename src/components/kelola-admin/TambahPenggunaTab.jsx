import { useState } from 'react';

const INITIAL_FORM = {
  nama: '',
  username: '',
  password: '',
  role: 'petugas',
};

export default function TambahPenggunaTab({ onSubmit, submitting }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const created = await onSubmit(form);
    if (created) setForm(INITIAL_FORM);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
      <div className="border-b border-indigo-100 bg-indigo-50/70 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <i className="fas fa-user-plus" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Tambah Pengguna</h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              Buat akun Petugas atau Mahasiswa Praktik. Password sementara harus diganti oleh pengguna melalui menu Setting Akun.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="new-user-nama" className="mb-1.5 block text-sm font-bold text-gray-700">Nama lengkap</label>
            <input
              id="new-user-nama"
              name="nama"
              value={form.nama}
              onChange={handleChange}
              required
              maxLength={100}
              autoComplete="off"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              placeholder="Nama pengguna"
            />
          </div>

          <div>
            <label htmlFor="new-user-username" className="mb-1.5 block text-sm font-bold text-gray-700">Username</label>
            <input
              id="new-user-username"
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9._-]+"
              autoCapitalize="none"
              autoComplete="off"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 font-mono text-sm lowercase outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              placeholder="contoh: mahasiswa01"
            />
            <p className="mt-1 text-[11px] text-gray-500">Gunakan huruf, angka, titik, garis bawah, atau tanda hubung.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="new-user-role" className="mb-1.5 block text-sm font-bold text-gray-700">Role pengguna</label>
            <select
              id="new-user-role"
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            >
              <option value="petugas">Petugas</option>
              <option value="mahasiswa">Mahasiswa Praktik</option>
            </select>
          </div>

          <div>
            <label htmlFor="new-user-password" className="mb-1.5 block text-sm font-bold text-gray-700">Password sementara</label>
            <div className="relative">
              <input
                id="new-user-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                required
                minLength={12}
                autoComplete="new-password"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-11 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                placeholder="Minimal 12 karakter"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-indigo-600"
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
          </div>
        </div>

        <div className={`rounded-xl border p-4 ${form.role === 'mahasiswa' ? 'border-cyan-200 bg-cyan-50' : 'border-blue-200 bg-blue-50'}`}>
          <p className="text-sm font-bold text-gray-800">
            <i className={`fas ${form.role === 'mahasiswa' ? 'fa-user-graduate text-cyan-600' : 'fa-user-nurse text-blue-600'} mr-2`} />
            Akses {form.role === 'mahasiswa' ? 'Mahasiswa Praktik' : 'Petugas'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            {form.role === 'mahasiswa'
              ? 'Hanya dapat CRUD data limbah per ruangan dan anorganik miliknya sendiri.'
              : 'Mendapat akses operasional petugas seperti yang berlaku saat ini.'}
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className={`fas ${submitting ? 'fa-spinner fa-spin' : 'fa-user-plus'}`} />
            {submitting ? 'Membuat Akun...' : 'Buat Akun'}
          </button>
        </div>
      </form>
    </div>
  );
}
