import { getCurrentUser } from '../lib/api';
import DashboardUser from '../components/dashboard/DashboardUser';
import DashboardAdmin from '../components/dashboard/DashboardAdmin';
import DashboardMahasiswa from '../components/dashboard/DashboardMahasiswa';
import WasteDataChatLauncher from '../components/chat/WasteDataChatLauncher';

export default function Dashboard() {
  const user = getCurrentUser();
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role === 'Admin';
  const isMahasiswa = user?.role?.toLowerCase() === 'mahasiswa';

  if (isAdmin) {
    return (
      <>
        <DashboardAdmin user={user} />
        <WasteDataChatLauncher />
      </>
    );
  }

  if (isMahasiswa) {
    return <DashboardMahasiswa user={user} />;
  }

  return (
    <>
      <DashboardUser user={user} />
      <WasteDataChatLauncher />
    </>
  );
}
