import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth/session';
import { listUsersAction } from '@/app/actions/user-actions';
import { UserManagementClient } from '@/components/admin/UserManagementClient';

export const metadata = {
  title: 'Manajemen Pengguna - 3D Warehouse Manager',
};

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const sessionData = await getAuthSession();

  if (!sessionData) {
    redirect('/login?callbackUrl=/admin/users');
  }

  if (sessionData.user.role !== 'ADMIN') {
    // Non-admin trying to access admin panel -> redirect to dashboard
    redirect('/');
  }

  const res = await listUsersAction();
  const initialUsers = res.users ?? [];

  return <UserManagementClient initialUsers={initialUsers} currentUser={sessionData.user} />;
}
