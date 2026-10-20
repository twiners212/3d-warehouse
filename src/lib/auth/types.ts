import type { UserRole } from '@/db/schema';

export type { UserRole };

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface SessionData {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    createdAt: Date;
  };
  user: AuthUser;
}
