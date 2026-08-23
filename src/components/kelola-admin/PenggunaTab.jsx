export default function PenggunaTab({
  users,
  filteredUsers,
  searchQuery,
  setSearchQuery,
  loading,
  error,
  resettingId,
  user,
  fetchUsers,
  handleResetPassword,
  kepalaUnit,
  savingKepalaUnit,
  handleSetKepalaUnit
}) {
  const getRoleBadge = (role) => {
    const r = role?.toLowerCase();
    if (r === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
          <i className="fas fa-user-shield text-[10px]"></i> Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
        <i className="fas fa-user text-[10px]"></i> Petugas
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="border-b border-indigo-100 bg-indigo-50/70 p-4 sm:p-5">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <i className="fas fa-user-tie"></i>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900">Kepala Unit Sanitasi</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-600">
              Nama pengguna terpilih akan otomatis dicantumkan pada bagian tanda tangan laporan.
            </p>
          </div>
        </div>

        <div className="relative">
          <select
            aria-label="Pilih Kepala Unit Sanitasi"
            value={kepalaUnit?.userId || ''}
            onChange={(event) => handleSetKepalaUnit(event.target.value)}
            disabled={loading || savingKepalaUnit}
            className="w-full appearance-none rounded-xl border border-indigo-200 bg-white px-4 py-3 pr-10 text-sm font-semibold text-gray-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">-- Pilih Kepala Unit Sanitasi --</option>
            {users.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nama} ({item.username})
              </option>
            ))}
          </select>
          <i
            className={`fas ${savingKepalaUnit ? 'fa-spinner fa-spin' : 'fa-chevron-down'} pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500`}
          ></i>
        </div>

        <p className="mt-2 text-[11px] text-gray-500">
          NIP akan ditampilkan otomatis setelah tersedia pada data pengguna.
        </p>
      </div>

      {/* Search Bar */}
      <div className="p-5 border-b border-gray-100">
        <div className="relative">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Cari nama, username, atau role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <i className="fas fa-times-circle"></i>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="m-5 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <i className="fas fa-exclamation-circle text-red-500"></i>
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={fetchUsers}
            className="ml-auto text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-lg font-semibold transition"
          >
            <i className="fas fa-sync-alt mr-1"></i>Coba Lagi
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-semibold text-sm tracking-wider">
            MEMUAT DATA PENGGUNA...
          </p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-user-slash text-3xl text-gray-400"></i>
          </div>
          <p className="text-gray-500 font-semibold">
            {searchQuery
              ? `Tidak ada pengguna dengan kata kunci "${searchQuery}"`
              : 'Belum ada data pengguna.'}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">#</th>
                  <th className="text-left px-6 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Nama</th>
                  <th className="text-left px-6 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Username</th>
                  <th className="text-left px-6 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Role</th>
                  <th className="text-center px-6 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((u, idx) => (
                  <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-6 py-4 text-gray-400 font-medium">{idx + 1}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-linear-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
                          {(u.nama || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-800">{u.nama}</span>
                        {u.id === kepalaUnit?.userId && (
                          <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            Kepala Unit
                          </span>
                        )}
                        {u.id === user?.id && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                            Anda
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-gray-600 text-xs bg-gray-100 px-2.5 py-1 rounded-lg">
                        {u.username}
                      </span>
                    </td>
                    <td className="px-6 py-4">{getRoleBadge(u.role)}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleResetPassword(u)}
                        disabled={resettingId === u.id}
                        title="Reset password ke bawaan"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {resettingId === u.id ? (
                          <><i className="fas fa-spinner fa-spin"></i>Mereset...</>
                        ) : (
                          <><i className="fas fa-key"></i>Reset Password</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-gray-100">
            {filteredUsers.map((u) => (
              <div key={u.id} className="p-4 hover:bg-indigo-50/20 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-full bg-linear-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
                    {(u.nama || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 truncate">{u.nama}</p>
                      {u.id === kepalaUnit?.userId && (
                        <span className="rounded-full border border-indigo-200 bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                          Kepala Unit
                        </span>
                      )}
                      {u.id === user?.id && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold border border-emerald-200">
                          Anda
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{u.username}</p>
                  </div>
                  {getRoleBadge(u.role)}
                </div>
                <button
                  onClick={() => handleResetPassword(u)}
                  disabled={resettingId === u.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                >
                  {resettingId === u.id ? (
                    <><i className="fas fa-spinner fa-spin"></i>Mereset Password...</>
                  ) : (
                    <><i className="fas fa-key"></i>Reset Password ke Bawaan</>
                  )}
                </button>
              </div>
            ))}
          </div>

          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Menampilkan <strong>{filteredUsers.length}</strong> dari <strong>{users.length}</strong> pengguna
            </p>
            <button
              onClick={fetchUsers}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition-colors"
            >
              <i className="fas fa-sync-alt text-[10px]"></i>Segarkan
            </button>
          </div>
        </>
      )}
    </div>
  );
}
