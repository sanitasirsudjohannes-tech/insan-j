import { getCurrentUser } from '../lib/api';
import DashboardUser from '../components/dashboard/DashboardUser';
import DashboardAdmin from '../components/dashboard/DashboardAdmin';

export default function Dashboard() {
  const user = getCurrentUser();
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role === 'Admin';

  if (isAdmin) {
    return <DashboardAdmin user={user} />;
  }

  return <DashboardUser user={user} />;
}
