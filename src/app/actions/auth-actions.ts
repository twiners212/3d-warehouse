'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyPassword } from '@/lib/auth/password';
import {
  createSession,
  deleteSessionCookie,
  getAuthSession,
  invalidateSession,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from '@/lib/auth/session';
import type { AuthUser } from '@/lib/auth/types';
import { cookies } from 'next/headers';

const LoginSchema = z.object({
  email: z.string().trim().email('Format email tidak valid'),
  password: z.string().min(1, 'Password harus diisi'),
});

export interface LoginActionResult {
  success: boolean;
  error?: string;
  user?: AuthUser;
}

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<LoginActionResult> {
  const parsed = LoginSchema.safeParse(input);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message ?? 'Data login tidak valid';
    return { success: false, error: errorMsg };
  }

  const { email, password } = parsed.data;

  const foundUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (foundUsers.length === 0) {
    return { success: false, error: 'Email atau password salah.' };
  }

  const user = foundUsers[0];
  const isMatch = await verifyPassword(password, user.passwordHash);

  if (!isMatch) {
    return { success: false, error: 'Email atau password salah.' };
  }

  // Create 24h session and set cookie
  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);

  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function logoutAction(): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      await invalidateSession(token);
    }
    await deleteSessionCookie();
  } catch (err) {
    console.error('Logout error:', err);
  }
  return { success: true };
}

export async function getCurrentUserAction(): Promise<AuthUser | null> {
  const sessionData = await getAuthSession();
  return sessionData?.user ?? null;
}
