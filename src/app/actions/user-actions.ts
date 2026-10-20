'use server';

import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import type { UserRole } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { getAuthSession } from '@/lib/auth/session';
import type { AuthUser } from '@/lib/auth/types';

/**
 * Asserts that the current request has an active session with role === 'ADMIN'.
 * Throws an error if unauthorized.
 */
async function assertAdmin(): Promise<AuthUser> {
  const sessionData = await getAuthSession();
  if (!sessionData) {
    throw new Error('Autentikasi diperlukan. Silakan login terlebih dahulu.');
  }
  if (sessionData.user.role !== 'ADMIN') {
    throw new Error('Akses ditolak: Hanya role Administrator yang memiliki izin mengelola pengguna.');
  }
  return sessionData.user;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export async function listUsersAction(): Promise<{
  success: boolean;
  users?: UserSummary[];
  error?: string;
}> {
  try {
    await assertAdmin();

    const userRows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    const formatted: UserSummary[] = userRows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }));

    return { success: true, users: formatted };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal memuat daftar pengguna.',
    };
  }
}

const CreateUserSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter'),
  email: z.string().trim().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']),
});

export async function createUserAction(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await assertAdmin();

    const parsed = CreateUserSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Data pengguna tidak valid' };
    }

    const { name, email, password, role } = parsed.data;

    // Check if email already registered
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: 'Email tersebut sudah terdaftar.' };
    }

    const passwordHash = await hashPassword(password);

    await db.insert(users).values({
      id: randomUUID(),
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal menambahkan pengguna.',
    };
  }
}

const UpdateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']),
});

export async function updateUserRoleAction(
  userId: string,
  newRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await assertAdmin();

    const parsed = UpdateRoleSchema.safeParse({ userId, role: newRole });
    if (!parsed.success) {
      return { success: false, error: 'Role tidak valid.' };
    }

    // Prevent admin from demoting themselves if they are the only admin
    if (userId === admin.id && newRole !== 'ADMIN') {
      return { success: false, error: 'Anda tidak dapat mengubah role akun admin Anda sendiri.' };
    }

    await db
      .update(users)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal memperbarui role pengguna.',
    };
  }
}

export async function deleteUserAction(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await assertAdmin();

    if (userId === admin.id) {
      return { success: false, error: 'Anda tidak dapat menghapus akun Anda sendiri saat sedang login.' };
    }

    await db.delete(users).where(eq(users.id, userId));

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal menghapus pengguna.',
    };
  }
}
