import DataMaintenanceTab from '../../../components/kelola-admin/DataMaintenanceTab';
import useDataMaintenance from '../../data-maintenance/hooks/useDataMaintenance';
import MySwal from './adminAlert';
export default function MaintenancePanel({ user }) {
  const maintenance = useDataMaintenance({ user, alert: MySwal });
  return <DataMaintenanceTab maintenance={maintenance} />;
}
