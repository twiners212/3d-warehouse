// Fulfills ARCHITECTURE.md Section 2 (app/editor/[id]/page.tsx):
// Main Editor Page wrapper. Server component resolves the blueprint id and
// hands off to the client editor shell with authenticated user profile.

import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth/session';
import { EditorLayout } from '@/components/editor/EditorLayout';

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionData = await getAuthSession();

  if (!sessionData) {
    redirect(`/login?callbackUrl=/editor/${encodeURIComponent(id)}`);
  }

  return <EditorLayout blueprintId={id} currentUser={sessionData.user} />;
}
