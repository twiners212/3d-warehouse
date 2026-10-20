import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth/session';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Login - 3D Warehouse Manager',
  description: 'Masuk ke sistem manajemen dan visualisasi 3D gudang',
};

export default async function LoginPage() {
  const session = await getAuthSession();
  if (session) {
    redirect('/');
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-neutral-950 px-4 py-12">
      {/* Background industrial grid accent */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293715_1px,transparent_1px),linear-gradient(to_bottom,#1f293715_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Subtle radial glow */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full flex justify-center">
        <Suspense fallback={<div className="text-xs text-slate-500">Memuat form login…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
