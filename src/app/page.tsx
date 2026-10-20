// Fulfills ARCHITECTURE.md Section 2 (app/page.tsx Dashboard / Blueprint list)
// Auth-protected Dashboard with RBAC session resolution and layout summaries.

import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth/session';
import { listWarehouseLayouts } from './actions/layout-actions';
import { DashboardClient } from '@/components/dashboard/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const sessionData = await getAuthSession();

  if (!sessionData) {
    redirect('/login');
  }

  const summaries = await listWarehouseLayouts();
  return <DashboardClient summaries={summaries} currentUser={sessionData.user} />;
}
