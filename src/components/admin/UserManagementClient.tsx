'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createUserAction,
  deleteUserAction,
  updateUserRoleAction,
} from '@/app/actions/user-actions';
import type { UserSummary } from '@/app/actions/user-actions';
import type { AuthUser, UserRole } from '@/lib/auth/types';
import { logoutAction } from '@/app/actions/auth-actions';
import {
  ArrowLeft,
  Boxes,
  Check,
  ChevronDown,
  Lock,
  LogOut,
  Mail,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';

interface Props {
  initialUsers: UserSummary[];
  currentUser: AuthUser;
}

export function UserManagementClient({ initialUsers, currentUser }: Props) {
  const router = useRouter();
  const [usersList, setUsersList] = useState<UserSummary[]>(initialUsers);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('EDITOR');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation
  const [pendingDeleteUser, setPendingDeleteUser] = useState<UserSummary | null>(null);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const res = await createUserAction({
      name: newName,
      email: newEmail,
      password: newPassword,
      role: newRole,
    });

    setIsSubmitting(false);

    if (res.success) {
      setFeedback({ type: 'success', message: `Pengguna ${newEmail} berhasil ditambahkan.` });
      setIsCreateModalOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('EDITOR');
      router.refresh();
    } else {
      setFeedback({ type: 'error', message: res.error ?? 'Gagal menambahkan pengguna.' });
    }
  }

  async function handleUpdateRole(userId: string, role: UserRole) {
    setFeedback(null);
    const res = await updateUserRoleAction(userId, role);
    if (res.success) {
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u))
      );
      setFeedback({ type: 'success', message: 'Role pengguna berhasil diperbarui.' });
      router.refresh();
    } else {
      setFeedback({ type: 'error', message: res.error ?? 'Gagal memperbarui role.' });
    }
  }

  async function handleDeleteUser() {
    if (!pendingDeleteUser) return;
    setFeedback(null);

    const res = await deleteUserAction(pendingDeleteUser.id);
    if (res.success) {
      setUsersList((prev) => prev.filter((u) => u.id !== pendingDeleteUser.id));
      setFeedback({ type: 'success', message: `Pengguna ${pendingDeleteUser.email} berhasil dihapus.` });
      setPendingDeleteUser(null);
      router.refresh();
    } else {
      setFeedback({ type: 'error', message: res.error ?? 'Gagal menghapus pengguna.' });
    }
  }

  async function handleLogout() {
    await logoutAction();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-slate-100 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Top Bar */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-neutral-900 text-slate-300 transition hover:bg-neutral-800 hover:text-white"
              title="Kembali ke Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-sky-400" />
                <h1 className="text-lg font-bold text-white">
                  Manajemen Pengguna & RBAC
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                Atur akun dan hak akses: Admin, Editor, dan Viewer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-neutral-900/80 px-3 py-1.5 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{currentUser.name}</span>
              <span className="rounded bg-indigo-950 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-700/50">
                {currentUser.role}
              </span>
            </div>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-sky-600/30 transition hover:from-sky-500 hover:to-blue-500"
            >
              <UserPlus className="h-4 w-4" />
              <span>Tambah User</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-neutral-900 text-slate-400 transition hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-800/50"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mb-6 flex items-center justify-between rounded-xl p-3 text-xs border ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Roles Overview Cards */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
              <ShieldCheck className="h-4 w-4" />
              <span>ADMIN</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Akses penuh: kelola akun, atur role, simpan dan hapus semua blueprint layout.
            </p>
          </div>

          <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
              <UserCheck className="h-4 w-4" />
              <span>EDITOR</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Membuat, mengedit, dan menyimpan layout gudang 3D. Tidak dapat mengelola user.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
              <Shield className="h-4 w-4" />
              <span>VIEWER</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Hanya mode baca. Dapat melihat 3D & WMS data, tetapi tombol simpan dinonaktifkan.
            </p>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-neutral-900/60 backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-neutral-900/90 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role RBAC</th>
                  <th className="py-3 px-4">Dibuat Pada</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {usersList.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  return (
                    <tr key={u.id} className="hover:bg-neutral-800/40 transition">
                      <td className="py-3.5 px-4 font-medium text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-300 font-bold text-xs uppercase">
                            {u.name.slice(0, 2)}
                          </div>
                          <div>
                            <div>{u.name}</div>
                            {isCurrent && (
                              <span className="text-[10px] text-sky-400">(Akun Anda)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">
                        {u.email}
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={u.role}
                          disabled={isCurrent}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition focus:outline-none ${
                            u.role === 'ADMIN'
                              ? 'border-indigo-500/40 bg-indigo-950/40 text-indigo-300'
                              : u.role === 'EDITOR'
                              ? 'border-sky-500/40 bg-sky-950/40 text-sky-300'
                              : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                          } disabled:opacity-70 disabled:cursor-not-allowed`}
                        >
                          <option value="ADMIN" className="bg-neutral-900 text-white">ADMIN</option>
                          <option value="EDITOR" className="bg-neutral-900 text-white">EDITOR</option>
                          <option value="VIEWER" className="bg-neutral-900 text-white">VIEWER</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {!isCurrent && (
                          <button
                            onClick={() => setPendingDeleteUser(u)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-950/40 hover:text-rose-400 transition"
                            title="Hapus Pengguna"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-neutral-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-sky-400" />
                Tambah Pengguna Baru
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full rounded-xl border border-slate-700 bg-neutral-950 py-2 px-3 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="budi@warehouse.local"
                  className="w-full rounded-xl border border-slate-700 bg-neutral-950 py-2 px-3 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Password Awal
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full rounded-xl border border-slate-700 bg-neutral-950 py-2 px-3 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Role Akses
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full rounded-xl border border-slate-700 bg-neutral-950 py-2 px-3 text-xs text-white focus:border-sky-500 focus:outline-none"
                >
                  <option value="VIEWER">VIEWER (Mode Baca)</option>
                  <option value="EDITOR">EDITOR (Simpan & Edit Layout)</option>
                  <option value="ADMIN">ADMIN (Kelola User & Data)</option>
                </select>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-slate-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-neutral-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-sky-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan…' : 'Simpan Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {pendingDeleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-neutral-900 p-6 shadow-2xl">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-950/60 text-rose-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">
              Hapus Pengguna Ini?
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Apakah Anda yakin ingin menghapus akun <span className="font-semibold text-white">{pendingDeleteUser.email}</span>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteUser(null)}
                className="rounded-xl border border-slate-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-neutral-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-500"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
