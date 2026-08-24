const TABS = [
  { id: 'pengguna', icon: 'fas fa-users', label: 'Pengguna' },
  { id: 'tambah-pengguna', icon: 'fas fa-user-plus', label: 'Tambah Pengguna' },
  { id: 'ruangan', icon: 'fas fa-door-open', label: 'Ruangan' },
  { id: 'pengaturan', icon: 'fas fa-sliders-h', label: 'Pengaturan' },
];

export default function AdminHeader({
  activeTab,
  setActiveTab,
  userCount,
  roomCount,
}) {
  const getLabel = (tab) => {
    if (tab.id === 'pengguna') return `${tab.label} (${userCount})`;
    if (tab.id === 'ruangan') return `${tab.label} (${roomCount})`;
    return tab.label;
  };

  return (
    <div className="bg-linear-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 mb-6 shadow-lg text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
            <span className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="fas fa-sliders-h text-lg" />
            </span>
            Kelola Admin & Master Data
          </h1>
          <p className="text-indigo-200 text-sm mt-1">
            Kelola akun pengguna dan master data ruangan rumah sakit.
          </p>
        </div>

        <div className="flex gap-2 bg-white/10 rounded-xl p-1.5 border border-white/20 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-indigo-100 hover:text-white'
              }`}
            >
              <i className={tab.icon} />
              {getLabel(tab)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
