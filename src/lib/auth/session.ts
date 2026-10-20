import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { eq, lt } from 'drizzle-orm';
import { db } from '@/db';
import { sessions, users } from '@/db/schema';
import type { SessionData } from './types';

export const SESSION_COOKIE_NAME = 'warehouse_session';
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Creates a new session record in the database for the given user ID.
 */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.insert(sessions).values({
    id: token,
    userId,
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Validates a session token by reading from the database and checking expiration.
 * If expired, cleans up the expired row and returns null.
 */
export async function validateSessionToken(token: string): Promise<SessionData | null> {
  if (!token || typeof token !== 'string') {
    return null;
  }

  // Find session joined with user
  const results = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .limit(1);

  if (results.length === 0) {
    return null;
  }

  const { session, user } = results[0];

  const now = new Date();
  if (session.expiresAt < now) {
    // Session expired; remove it
    await db.delete(sessions).where(eq(sessions.id, token));
    return null;
  }

  return {
    session: {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

/**
 * Revokes and deletes a session token from the database.
 */
export async function invalidateSession(token: string): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, token));
}

/**
 * Purges all expired sessions from the database.
 */
export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/**
 * Server-side helper to read the active session from request cookies.
 * Uses Next.js next/headers cookies() store.
 */
export async function getAuthSession(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return null;
    }
    const validated = await validateSessionToken(token);
    if (!validated) {
      // Proactively clear invalid/expired session cookie to prevent lingering stale headers
      try {
        cookieStore.delete(SESSION_COOKIE_NAME);
      } catch {
        // Ignore if headers are read-only
      }
      return null;
    }
    return validated;
  } catch {
    // If called outside of a request context (e.g. standalone test script), return null
    return null;
  }
}

/**
 * Sets the session cookie on the active response.
 */
export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/**
 * Clears the session cookie on the active response.
 */
export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
