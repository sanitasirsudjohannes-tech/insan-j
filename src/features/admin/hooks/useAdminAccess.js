import { useSession } from '../../session/SessionContext';

export default function useAdminAccess(user) {
  const session = useSession();
  return {
    verified: Boolean(session?.status === 'authenticated'
      && session.adminVerified
      && session.user?.id === user?.id
      && session.user?.role?.trim().toLowerCase() === 'admin'),
    retrySession: session?.retrySession,
  };
}
