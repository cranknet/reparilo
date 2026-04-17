# Unified User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a single-source user management system with avatar uploads, enriched sessions/activity, and wired-up Add User / Disable / Edit flows across Settings and Profile pages.

**Architecture:** Settings > Users tab acts as the list/management hub. Profile page becomes the detail/edit view for any user (self or others, admin-only). Backend gains avatar upload/delete endpoints and relaxes session visibility for admins.

**Tech Stack:** React + TypeScript, Zustand stores, Fastify REST API, Prisma ORM, @fastify/multipart (already registered), local disk file storage.

---

### Task 1: Backend — Avatar Upload/Delete Endpoints

**Files:**
- Create: `server/services/avatar.service.ts`
- Modify: `server/routes/users.ts`

- [ ] **Step 1: Create avatar service**

Create `server/services/avatar.service.ts` following the pattern from `server/services/job-photos.service.ts`:

```typescript
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

const UPLOAD_DIR = path.resolve("uploads/avatars");
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024;

const MAGIC_BYTES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};

const WEBP_MARKER = [0x57, 0x45, 0x42, 0x50];

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function validateMagicBytes(buffer: Buffer, mime: string): boolean {
  const expected = MAGIC_BYTES[mime];
  if (!expected) return false;
  const headerMatch = expected.every((byte, i) => buffer[i] === byte);
  if (!headerMatch) return false;
  if (mime === "image/webp") {
    const offset = 8;
    return WEBP_MARKER.every((byte, i) => buffer[offset + i] === byte);
  }
  return true;
}

export async function uploadAvatar(
  prisma: PrismaClient,
  userId: string,
  file: { mimetype: string; toBuffer: () => Promise<Buffer> }
) {
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    return { error: "INVALID_FILE_TYPE" as const };
  }

  const buffer = await file.toBuffer();
  if (buffer.length > MAX_SIZE) {
    return { error: "FILE_TOO_LARGE" as const };
  }
  if (!validateMagicBytes(buffer, file.mimetype)) {
    return { error: "INVALID_FILE_CONTENT" as const };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
  if (!user) return null;

  if (user.image) {
    const oldPath = path.resolve("uploads", user.image);
    await fs.unlink(oldPath).catch(() => {});
  }

  const ext = extFromMime(file.mimetype);
  const filename = `${userId}_${crypto.randomUUID()}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filePath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(filePath, buffer);

  const relativePath = `avatars/${filename}`;
  await prisma.user.update({
    where: { id: userId },
    data: { image: relativePath },
  });

  return { image: relativePath };
}

export async function deleteAvatar(
  prisma: PrismaClient,
  userId: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });
  if (!user) return null;
  if (!user.image) return { image: null };

  const fullPath = path.resolve("uploads", user.image);
  await fs.unlink(fullPath).catch(() => {});

  await prisma.user.update({
    where: { id: userId },
    data: { image: null },
  });

  return { image: null };
}
```

- [ ] **Step 2: Add avatar routes to users.ts**

In `server/routes/users.ts`, add the import at the top:

```typescript
import { deleteAvatar, uploadAvatar } from "../services/avatar.service.js";
```

Then add these two routes before the closing `};` of `usersRoutes` (after the `app.delete("/:id/sessions/:sessionId", ...)` route):

```typescript
  app.post(
    "/:id/avatar",
    {
      preHandler: [requirePermission("users:write")],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const requestingUser = request.user;

      if (!requestingUser) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      if (requestingUser.id !== id) {
        return reply.status(403).send({ error: "Can only update own avatar" });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: "No file provided" });
      }

      const result = await uploadAvatar(app.prisma, id, data);
      if (!result) {
        return reply.status(404).send({ error: "User not found" });
      }
      if ("error" in result) {
        const status = result.error === "FILE_TOO_LARGE" ? 413 : 400;
        return reply.status(status).send({ error: result.error });
      }

      return reply.send(result);
    }
  );

  app.delete(
    "/:id/avatar",
    {
      preHandler: [requirePermission("users:write")],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const requestingUser = request.user;

      if (!requestingUser) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      if (requestingUser.id !== id) {
        return reply.status(403).send({ error: "Can only delete own avatar" });
      }

      const result = await deleteAvatar(app.prisma, id);
      if (!result) {
        return reply.status(404).send({ error: "User not found" });
      }

      return reply.send(result);
    }
  );
```

- [ ] **Step 3: Add `image` to GET /users select**

In `server/routes/users.ts`, find the `app.get("/", ...)` handler and add `image: true` to the `select` object:

```typescript
      const users = await app.prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
          image: true,
        },
        orderBy: { createdAt: "desc" },
      });
```

- [ ] **Step 4: Commit**

```bash
git add server/services/avatar.service.ts server/routes/users.ts
git commit -m "feat: add avatar upload/delete endpoints and include image in user list"
```

---

### Task 2: Backend — Relax Session Visibility & Activity Pagination

**Files:**
- Modify: `server/routes/users.ts`

- [ ] **Step 1: Allow admins to view any user's sessions**

In `server/routes/users.ts`, find the `app.get("/:id/sessions", ...)` handler. Replace the self-only check:

```typescript
    if (requestingUser.id !== id) {
      return reply.status(403).send({ error: "Can only view own sessions" });
    }
```

With:

```typescript
    const perms = ROLE_PERMISSIONS[requestingUser.role as RoleType] ?? [];
    const isAdmin = perms.includes("users:write");
    if (requestingUser.id !== id && !isAdmin) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }
```

Add the import at the top if not already present:

```typescript
import { ROLE_PERMISSIONS, type RoleType } from "@shared/constants/roles";
```

- [ ] **Step 2: Add cursor pagination to activity endpoint**

In the `app.get("/:id/activity", ...)` handler, add cursor support:

```typescript
  app.get("/:id/activity", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { cursor, limit } = request.query as { cursor?: string; limit?: string };
    const requestingUser = request.user;

    if (!requestingUser) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    if (!canViewUserActivity(requestingUser.id, id, requestingUser.role)) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }

    const take = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const logs = await app.prisma.auditLog.findMany({
      where: { userId: id, ...(cursor ? { id: { lt: cursor } } : {}) },
      select: {
        id: true,
        action: true,
        fromValue: true,
        toValue: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    const nextCursor = logs.length === take ? logs[logs.length - 1]?.id : null;

    return reply.send({ items: logs, nextCursor });
  });
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/users.ts
git commit -m "feat: allow admins to view any user sessions, add activity pagination"
```

---

### Task 3: Frontend — Add User Modal Component

**Files:**
- Create: `src/components/modules/settings/add-user-modal.tsx`

- [ ] **Step 1: Create AddUserModal component**

Create `src/components/modules/settings/add-user-modal.tsx` following the `add-part-modal.tsx` pattern:

```tsx
import type { RoleType } from "@shared/constants";
import { Role } from "@shared/constants";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface AddUserModalProps {
  onClose: () => void;
  onSubmit: (data: {
    username: string;
    email: string;
    password: string;
    role: RoleType;
  }) => Promise<void>;
}

const ROLES: RoleType[] = Object.values(Role);

export default function AddUserModal({ onClose, onSubmit }: AddUserModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "" as RoleType | "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<"username" | "email" | "password" | "role", string>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState("");

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in errors) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
    setConflictError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Partial<
      Record<"username" | "email" | "password" | "role", string>
    > = {};
    if (!form.username.trim() || form.username.length < 3) {
      newErrors.username = t("add_user_modal_error_username");
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      newErrors.email = t("add_user_modal_error_email");
    }
    if (!form.password || form.password.length < 8) {
      newErrors.password = t("add_user_modal_error_password");
    }
    if (!form.role) {
      newErrors.role = t("add_user_modal_error_role");
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        username: form.username,
        email: form.email,
        password: form.password,
        role: form.role as RoleType,
      });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const msg = axiosErr.response?.data?.error || "Failed to create user";
      if (msg.toLowerCase().includes("already")) {
        setConflictError(t("add_user_modal_error_conflict"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const labelCls = "mb-2 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        aria-hidden="true"
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-[20px]"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClose();
        }}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-labelledby="add-user-modal-title"
        aria-modal="true"
        className="relative z-10 mx-4 w-full max-w-[520px] overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl"
        role="dialog"
      >
        <form onSubmit={handleSubmit}>
          <div className="bg-surface-container-low px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h2
                  className="font-bold font-headline text-on-surface text-xl tracking-tight"
                  id="add-user-modal-title"
                >
                  {t("add_user_modal_title")}
                </h2>
                <p className="mt-0.5 text-on-surface-variant text-sm">
                  {t("add_user_modal_subtitle")}
                </p>
              </div>
              <button
                aria-label={t("close")}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                onClick={onClose}
                type="button"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-5 px-6 py-6">
            {conflictError && (
              <div className="rounded-xl bg-error-container p-3">
                <p className="font-bold text-on-error-container text-xs">
                  {conflictError}
                </p>
              </div>
            )}

            <div>
              <Label className={labelCls} htmlFor="add-user-username">
                {t("add_user_modal_username")}
              </Label>
              <Input
                id="add-user-username"
                onChange={(e) => update("username", e.target.value)}
                placeholder={t("add_user_modal_username")}
                value={form.username}
              />
              {errors.username && (
                <p className="mt-1.5 text-error text-sm">{errors.username}</p>
              )}
            </div>

            <div>
              <Label className={labelCls} htmlFor="add-user-email">
                {t("add_user_modal_email")}
              </Label>
              <Input
                id="add-user-email"
                onChange={(e) => update("email", e.target.value)}
                placeholder="user@example.com"
                type="email"
                value={form.email}
              />
              {errors.email && (
                <p className="mt-1.5 text-error text-sm">{errors.email}</p>
              )}
            </div>

            <div>
              <Label className={labelCls} htmlFor="add-user-password">
                {t("add_user_modal_password")}
              </Label>
              <Input
                id="add-user-password"
                onChange={(e) => update("password", e.target.value)}
                placeholder="••••••••"
                type="password"
                value={form.password}
              />
              {errors.password && (
                <p className="mt-1.5 text-error text-sm">{errors.password}</p>
              )}
            </div>

            <div>
              <Label className={labelCls} htmlFor="add-user-role">
                {t("add_user_modal_role")}
              </Label>
              <div className="relative">
                <Select
                  id="add-user-role"
                  onChange={(e) => update("role", e.target.value as RoleType)}
                  value={form.role}
                >
                  <option disabled value="">
                    {t("add_user_modal_role")}
                  </option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`role.${r}`)}
                    </option>
                  ))}
                </Select>
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2">
                  <Icon name="expand_more" size="sm" />
                </span>
              </div>
              {errors.role && (
                <p className="mt-1.5 text-error text-sm">{errors.role}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4">
            <Button onClick={onClose} type="button" variant="secondary">
              {t("cancel")}
            </Button>
            <Button loading={submitting} type="submit">
              {t("add_user_modal_submit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/modules/settings/add-user-modal.tsx
git commit -m "feat: add AddUserModal component"
```

---

### Task 4: Frontend — Reset Password Modal Component

**Files:**
- Create: `src/components/modules/settings/reset-password-modal.tsx`

- [ ] **Step 1: Create ResetPasswordModal component**

Create `src/components/modules/settings/reset-password-modal.tsx`:

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ResetPasswordModalProps {
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
  username: string;
}

export default function ResetPasswordModal({
  onClose,
  onSubmit,
  username,
}: ResetPasswordModalProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || password.length < 8) {
      setError(t("add_user_modal_error_password"));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(password);
    } catch {
      setError(t("profile_password_update_failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        aria-hidden="true"
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-[20px]"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClose();
        }}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-labelledby="reset-password-modal-title"
        aria-modal="true"
        className="relative z-10 mx-4 w-full max-w-[440px] overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl"
        role="dialog"
      >
        <form onSubmit={handleSubmit}>
          <div className="bg-surface-container-low px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h2
                  className="font-bold font-headline text-on-surface text-xl tracking-tight"
                  id="reset-password-modal-title"
                >
                  {t("reset_password_title")}
                </h2>
                <p className="mt-0.5 text-on-surface-variant text-sm">
                  {t("reset_password_desc", { name: username })}
                </p>
              </div>
              <button
                aria-label={t("close")}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                onClick={onClose}
                type="button"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-5 px-6 py-6">
            {error && (
              <div className="rounded-xl bg-error-container p-3">
                <p className="font-bold text-on-error-container text-xs">
                  {error}
                </p>
              </div>
            )}
            <div>
              <Label className="mb-2 block" htmlFor="reset-password-new">
                {t("reset_password_new")}
              </Label>
              <Input
                id="reset-password-new"
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="••••••••"
                type="password"
                value={password}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4">
            <Button onClick={onClose} type="button" variant="secondary">
              {t("cancel")}
            </Button>
            <Button loading={submitting} type="submit">
              {t("reset_password_submit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/modules/settings/reset-password-modal.tsx
git commit -m "feat: add ResetPasswordModal component"
```

---

### Task 5: Frontend — Update Users Store

**Files:**
- Modify: `src/stores/users.ts`

- [ ] **Step 1: Add image to UserRow and updateUserAvatar action**

Update `src/stores/users.ts`:

```typescript
import type { RoleType } from "@shared/constants";
import { create } from "zustand";
import api from "@/lib/api";

interface UserRow {
  createdAt: string;
  email: string;
  id: string;
  image: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  role: RoleType;
  username: string;
}

interface UsersState {
  clearError: () => void;
  createUser: (data: {
    username: string;
    email: string;
    password: string;
    role: RoleType;
  }) => Promise<UserRow>;
  error: string | null;

  fetchUsers: () => Promise<void>;
  isLoading: boolean;
  resetUserPassword: (id: string, password: string) => Promise<void>;
  toggleUserStatus: (id: string, isActive: boolean) => Promise<void>;
  updateUserAvatar: (id: string, imagePath: string | null) => void;
  users: UserRow[];
}

export const useUsersStore = create<UsersState>((set) => ({
  users: [],
  isLoading: false,
  error: null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/users");
      set({ users: res.data, isLoading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch users";
      set({ isLoading: false, error: message });
    }
  },

  createUser: async (data) => {
    set({ error: null });
    try {
      const res = await api.post("/users", data);
      const newUser = res.data as UserRow;
      set((state) => ({ users: [newUser, ...state.users] }));
      return newUser;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create user";
      set({ error: message });
      throw new Error(message);
    }
  },

  toggleUserStatus: async (id, isActive) => {
    set({ error: null });
    try {
      const res = await api.patch(`/users/${id}/status`, { isActive });
      const updated = res.data as UserRow;
      set((state) => ({
        users: state.users.map((u) => (u.id === id ? updated : u)),
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to toggle user status";
      set({ error: message });
    }
  },

  resetUserPassword: async (id, password) => {
    set({ error: null });
    try {
      await api.post(`/users/${id}/reset-password`, { password });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to reset password";
      set({ error: message });
      throw new Error(message);
    }
  },

  updateUserAvatar: (id, imagePath) => {
    set((state) => ({
      users: state.users.map((u) =>
        u.id === id ? { ...u, image: imagePath } : u
      ),
    }));
  },

  clearError: () => set({ error: null }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/users.ts
git commit -m "feat: add image field and updateUserAvatar to users store"
```

---

### Task 6: Frontend — Wire Up Settings Users Tab

**Files:**
- Modify: `src/pages/settings/index.tsx`

- [ ] **Step 1: Add imports and state for modals**

At the top of `src/pages/settings/index.tsx`, add the new imports:

```typescript
import { useNavigate } from "react-router";
import { useAuthStore } from "@/stores/auth";
import AddUserModal from "@/components/modules/settings/add-user-modal";
import ResetPasswordModal from "@/components/modules/settings/reset-password-modal";
```

Inside the `SettingsPage` component, after the existing state declarations (around line 98), add:

```typescript
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: string; username: string } | null>(null);
```

- [ ] **Step 2: Add modal handlers**

After the `handleCancel` function, add:

```typescript
  async function handleCreateUser(data: {
    username: string;
    email: string;
    password: string;
    role: "OWNER" | "TECHNICIAN" | "FRONT_DESK";
  }) {
    await useUsersStore.getState().createUser(data);
    setShowAddUserModal(false);
  }

  async function handleResetPassword(password: string) {
    if (!resetTarget) return;
    await useUsersStore.getState().resetUserPassword(resetTarget.id, password);
    setShowResetModal(false);
    setResetTarget(null);
  }
```

- [ ] **Step 3: Update renderUsersSection to wire up actions**

Replace the entire `renderUsersSection` function with a version that:
1. Uses `<Avatar>` for user thumbnails.
2. "Add User" button opens the modal.
3. Edit button navigates to `/profile/:userId`.
4. Disable/Enable toggle calls `toggleUserStatus`.
5. Shows a "Reset Password" option in the action area.

```typescript
  function renderUsersSection() {
    if (usersLoading) {
      return (
        <div className="flex items-center justify-center py-16">
          <span className="material-symbols-outlined animate-spin text-3xl text-primary">
            progress_activity
          </span>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <button
            className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-bold text-on-primary text-sm transition-all active:opacity-80"
            onClick={() => setShowAddUserModal(true)}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">
              person_add
            </span>
            {t("add_user")}
          </button>
        </div>
        {users.length === 0 ? (
          <div className="rounded-2xl bg-surface-container-low py-12 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">
              group_off
            </span>
            <p className="mt-3 text-on-surface-variant text-sm">
              {t("no_users_found")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const roleCfg = ROLE_CONFIG[user.role] ?? {
                color: "bg-surface-container text-on-surface-variant",
                icon: "person",
              };
              const isSelf = user.id === currentUser?.id;
              return (
                <div
                  className="flex items-center gap-4 rounded-2xl bg-surface-container-low p-4 transition-colors hover:bg-surface-container-high/60"
                  key={user.id}
                >
                  <Avatar
                    initials={user.username.charAt(0).toUpperCase()}
                    size="md"
                    src={user.image ? `/api/uploads/${user.image}` : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-on-surface text-sm">
                        {user.username}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold text-xs uppercase ${roleCfg.color}`}
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          {roleCfg.icon}
                        </span>
                        {t(`role.${user.role}`)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-on-surface-variant text-xs">
                      {user.email}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium text-xs ${user.isActive ? "bg-success/10 text-success" : "bg-on-surface-variant/10 text-on-surface-variant"}`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${user.isActive ? "bg-success" : "bg-on-surface-variant/40"}`}
                      />
                      {user.isActive
                        ? t("status_active")
                        : t("status_inactive")}
                    </span>
                    {!isSelf && (
                      <button
                        aria-checked={user.isActive}
                        aria-label={user.isActive ? t("disable_user") : t("enable_user")}
                        className={`relative h-[30px] w-[48px] rounded-full transition-colors ${
                          user.isActive ? "bg-primary" : "bg-surface-container-highest"
                        }`}
                        onClick={async () => {
                          await useUsersStore.getState().toggleUserStatus(user.id, !user.isActive);
                        }}
                        role="switch"
                        type="button"
                      >
                        <span
                          className={`inline-start-[3px] absolute top-[3px] h-[24px] w-[24px] rounded-full bg-surface-container-lowest shadow-sm transition-transform ${
                            user.isActive
                              ? "ltr:translate-x-[18px] rtl:-translate-x-[18px]"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    )}
                    <button
                      aria-label={t("reset_password_title")}
                      className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg p-2 text-on-surface-variant text-xs transition-colors hover:bg-surface-container hover:text-primary"
                      onClick={() => {
                        setResetTarget({ id: user.id, username: user.username });
                        setShowResetModal(true);
                      }}
                      title={t("reset_password_title")}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        lock_reset
                      </span>
                    </button>
                    <button
                      aria-label={`${t("edit")} ${user.username}`}
                      className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg p-2 text-on-surface-variant text-xs transition-colors hover:bg-surface-container hover:text-primary"
                      onClick={() => navigate(`/profile/${user.id}`)}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        edit
                      </span>
                      <span className="hidden sm:inline">{t("edit")}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
```

- [ ] **Step 4: Add modal rendering and Avatar import**

Add the `Avatar` import:

```typescript
import { Avatar } from "@/components/ui/avatar";
```

At the end of the return JSX, just before the closing `</>`, add:

```tsx
      {showAddUserModal && (
        <AddUserModal
          onClose={() => setShowAddUserModal(false)}
          onSubmit={handleCreateUser}
        />
      )}
      {showResetModal && resetTarget && (
        <ResetPasswordModal
          onClose={() => {
            setShowResetModal(false);
            setResetTarget(null);
          }}
          onSubmit={handleResetPassword}
          username={resetTarget.username}
        />
      )}
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/settings/index.tsx
git commit -m "feat: wire up Add User modal, disable toggle, reset password, edit navigation in settings"
```

---

### Task 7: Frontend — Update App.tsx Routes

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add /profile/:userId route**

In `src/App.tsx`, find the existing profile route (around line 95-102):

```tsx
        <Route
          element={
            <DashboardLayout>
              <ProfilePage />
            </DashboardLayout>
          }
          path="/profile"
        />
```

Add a second route for the parametrized path right after it:

```tsx
        <Route
          element={
            <DashboardLayout>
              <ProfilePage />
            </DashboardLayout>
          }
          path="/profile"
        />
        <Route
          element={
            <DashboardLayout>
              <ProfilePage />
            </DashboardLayout>
          }
          path="/profile/:userId"
        />
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add /profile/:userId route for multi-user profile view"
```

---

### Task 8: Frontend — Enhance Profile Page for Multi-User View

**Files:**
- Modify: `src/pages/profile/index.tsx`

This is the largest task. The profile page needs to:
1. Accept an optional `userId` route param.
2. Fetch target user data if viewing another user.
3. Use `<Avatar>` with image support and upload.
4. Enrich activity with job links and pagination.
5. Enrich sessions with login time and expiry.
6. Show "Reset Password" instead of password change for other users.
7. Show "Back to Users" when viewing another user.

- [ ] **Step 1: Add imports and route param**

At the top of `src/pages/profile/index.tsx`, add:

```typescript
import { useParams, useNavigate } from "react-router";
import { Avatar } from "@/components/ui/avatar";
import { useUsersStore } from "@/stores/users";
import ResetPasswordModal from "@/components/modules/settings/reset-password-modal";
```

- [ ] **Step 2: Update ActivityItem to include metadata**

```typescript
interface ActivityItem {
  action: string;
  createdAt: string;
  fromValue: string | null;
  id: string;
  metadata?: { jobId?: string } | null;
  toValue: string | null;
}
```

- [ ] **Step 3: Add isViewingOther, targetUser state, and data fetching**

Inside `ProfilePage()`, after the existing store hooks, add:

```typescript
  const { userId: routeUserId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const isSelf = !routeUserId || routeUserId === currentUser?.id;
  const userId = isSelf ? currentUser?.id : routeUserId;
```

Add state for target user data:

```typescript
  const [targetUser, setTargetUser] = useState<{
    email: string;
    id: string;
    image: string | null;
    isActive: boolean;
    name: string;
    role: string;
    username: string;
  } | null>(null);
  const [targetLoading, setTargetLoading] = useState(false);
```

Add a useEffect to fetch target user data when viewing another user:

```typescript
  useEffect(() => {
    if (isSelf || !routeUserId) {
      setTargetUser(null);
      return;
    }
    setTargetLoading(true);
    api
      .get(`/users/${routeUserId}`)
      .then((res) => setTargetUser(res.data))
      .catch(() => setTargetUser(null))
      .finally(() => setTargetLoading(false));
  }, [isSelf, routeUserId]);
```

Update `displayName`, `initials`, and `role` to use target user when applicable:

```typescript
  const displayUser = isSelf
    ? {
        name: user?.name || user?.username || t("default_user_display"),
        username: user?.username || "",
        email: user?.email || "",
        image: user?.image || null,
        role,
      }
    : {
        name: targetUser?.name || targetUser?.username || t("default_user_display"),
        username: targetUser?.username || "",
        email: targetUser?.email || "",
        image: targetUser?.image || null,
        role: targetUser?.role || "FRONT_DESK",
      };

  const displayName = displayUser.name;
  const initials = getInitials(displayName);
```

Note: Remove the old `displayName` and `initials` declarations that used `user` directly.

- [ ] **Step 4: Add avatar upload handler**

Add state for avatar upload:

```typescript
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
```

Add handler:

```typescript
  async function handleAvatarUpload(file: File) {
    if (!isSelf) return;
    const formData = new FormData();
    formData.append("file", file);
    setAvatarUploading(true);
    try {
      const res = await api.post(`/users/${userId}/avatar`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const newImage = res.data.image;
      await checkSession(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const errorMsg = axiosErr.response?.data?.error;
      if (errorMsg === "FILE_TOO_LARGE") {
        setPersonalError(t("profile_avatar_too_large"));
      } else if (errorMsg === "INVALID_FILE_TYPE") {
        setPersonalError(t("profile_avatar_invalid_type"));
      }
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleAvatarRemove() {
    if (!isSelf || !user?.image) return;
    try {
      await api.delete(`/users/${userId}/avatar`);
      await checkSession(true);
    } catch {
      // error handled by interceptor
    }
  }
```

- [ ] **Step 5: Update activity loading for pagination**

Add pagination state:

```typescript
  const [activityCursor, setActivityCursor] = useState<string | null>(null);
  const [hasMoreActivity, setHasMoreActivity] = useState(false);
```

Update the `loadActivity` callback:

```typescript
  const loadActivity = useCallback(
    async (append = false) => {
      if (!userId) return;
      setActivityLoading(true);
      try {
        const params = new URLSearchParams();
        if (append && activityCursor) {
          params.set("cursor", activityCursor);
        }
        const res = await api.get(`/users/${userId}/activity?${params.toString()}`);
        const data = res.data;
        const items = data.items ?? data;
        setActivityCursor(data.nextCursor ?? null);
        setHasMoreActivity(!!data.nextCursor);
        if (append) {
          setActivity((prev) => [...prev, ...items]);
        } else {
          setActivity(items);
        }
      } catch {
        if (!append) setActivity([]);
      } finally {
        setActivityLoading(false);
      }
    },
    [userId, activityCursor]
  );
```

Update the activity useEffect:

```typescript
  useEffect(() => {
    if (activeTab === "activity") {
      setActivityCursor(null);
      loadActivity(false);
    }
  }, [activeTab]);
```

- [ ] **Step 6: Replace avatar circle with Avatar component**

In the sidebar section, replace the initials div (around lines 761-764) with:

```tsx
          <div className="relative">
            <Avatar
              alt={displayName}
              className="h-24 w-24 text-3xl"
              initials={initials}
              size="lg"
              src={displayUser.image ? `/api/uploads/${displayUser.image}` : undefined}
            />
            {isSelf && (
              <button
                className="absolute end-0 bottom-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-on-primary shadow-md transition-all hover:bg-primary-container"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <span className="material-symbols-outlined text-[14px]">
                  photo_camera
                </span>
              </button>
            )}
            {isSelf && avatarUploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-on-surface/30">
                <span className="material-symbols-outlined animate-spin text-[24px] text-on-primary">
                  progress_activity
                </span>
              </div>
            )}
            <input
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAvatarUpload(file);
                e.target.value = "";
              }}
              ref={fileInputRef}
              type="file"
            />
            <div className="absolute end-0 bottom-1 h-4 w-4 rounded-full border-4 border-surface-container-lowest bg-success" />
          </div>
```

Note: Remove the old green online indicator div and the separate "Change Avatar" button at the bottom of the sidebar. The camera icon overlay replaces both.

- [ ] **Step 7: Add "Back to Users" link and conditional title**

Before the profile sidebar section, add a back link when viewing another user:

```tsx
      {!isSelf && (
        <button
          className="mb-4 flex items-center gap-1 text-on-surface-variant text-sm transition-colors hover:text-primary"
          onClick={() => navigate("/settings")}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          {t("profile_back_to_users")}
        </button>
      )}
```

Update the page title to show the user's name when viewing another:

```tsx
        <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
          {isSelf ? t("profile_title") : t("profile_viewing_user", { name: displayName })}
        </h2>
```

- [ ] **Step 8: Update renderSecuritySection for other users**

When viewing another user, replace the password change form with a "Reset Password" button. Add import:

```typescript
import ResetPasswordModal from "@/components/modules/settings/reset-password-modal";
```

Add state:

```typescript
  const [showResetModal, setShowResetModal] = useState(false);
```

At the top of `renderSecuritySection`, add the conditional:

```typescript
  function renderSecuritySection() {
    if (!isSelf) {
      return (
        <div className="space-y-6">
          <h4 className="font-bold font-headline text-on-surface text-sm">
            {t("reset_password_title")}
          </h4>
          <p className="text-on-surface-variant text-sm">
            {t("reset_password_desc", { name: displayName })}
          </p>
          <button
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-surface-tint px-6 py-2.5 font-bold text-on-primary text-sm shadow-lg shadow-primary/20 transition-all active:opacity-80"
            onClick={() => setShowResetModal(true)}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">lock_reset</span>
            {t("reset_password_submit")}
          </button>

          <div className="h-px bg-outline-variant/10" />

          <div className="space-y-4">
            <h4 className="font-bold font-headline text-on-surface text-sm">
              {t("profile_active_sessions")}
            </h4>
            {renderSessionList()}
          </div>

          {showResetModal && (
            <ResetPasswordModal
              onClose={() => setShowResetModal(false)}
              onSubmit={async (password) => {
                if (!userId) return;
                await useUsersStore.getState().resetUserPassword(userId, password);
                setShowResetModal(false);
              }}
              username={displayUser.username}
            />
          )}
        </div>
      );
    }
    // ... existing self security section code (password change + sessions)
```

Extract the sessions list into a reusable `renderSessionList` function:

```typescript
  function renderSessionList() {
    if (sessionsLoading) {
      return (
        <div className="flex items-center justify-center py-6">
          <span className="material-symbols-outlined animate-spin text-[24px] text-on-surface-variant">
            progress_activity
          </span>
        </div>
      );
    }
    if (sessions.length === 0) {
      return (
        <p className="text-on-surface-variant text-sm">
          {t("profile_no_sessions")}
        </p>
      );
    }
    return (
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-4"
            key={session.id}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                {session.userAgent?.includes("Mobile")
                  ? "smartphone"
                  : "laptop_mac"}
              </span>
              <div>
                <p className="font-semibold text-sm">
                  {session.userAgent
                    ? parseUserAgent(session.userAgent)
                    : t("profile_unknown_device")}
                  {session.isCurrent
                    ? ` — ${t("profile_current_session")}`
                    : ""}
                </p>
                <p className="text-on-surface-variant text-xs">
                  {session.ipAddress ?? t("profile_unknown_ip")}
                </p>
                <p className="text-on-surface-variant/60 text-xs">
                  {t("profile_login_time")}: {new Date(session.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {session.isCurrent ? (
                <>
                  <div className="h-2.5 w-2.5 rounded-full bg-success" />
                  <span className="font-bold text-success text-xs uppercase">
                    {t("profile_active")}
                  </span>
                </>
              ) : (
                <button
                  className="font-bold text-tertiary text-xs transition-colors hover:text-tertiary-container"
                  onClick={() => handleRevokeSession(session.id)}
                  type="button"
                >
                  {t("profile_end_session")}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }
```

Then update the existing self security section to use `renderSessionList()` instead of the inline sessions code.

- [ ] **Step 9: Enrich renderActivitySection with job links and pagination**

Update the activity item rendering to include job links and a "Load More" button:

Replace the activity item map with:

```tsx
            {activity.map((item, idx) => {
              const jobMatch = item.toValue?.match(/#(\w+-\d+)/) || item.metadata?.jobId;
              return (
                <div className="flex gap-4" key={item.id}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${ACTION_ICONS[item.action] ? "bg-primary/10 text-primary" : "bg-surface-container-high text-on-surface-variant"}`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {ACTION_ICONS[item.action] ?? "history"}
                      </span>
                    </div>
                    {idx < activity.length - 1 && (
                      <div className="my-1 h-full w-0.5 bg-surface-container-high" />
                    )}
                  </div>
                  <div className="pb-2">
                    <p className="font-semibold text-sm">
                      {t(formatAction(item.action), {
                        from: item.fromValue ?? "",
                        to: item.toValue ?? "",
                      })}
                    </p>
                    <p
                      className="mt-1 font-bold text-on-surface-variant/50 text-xs uppercase"
                      title={new Date(item.createdAt).toLocaleString()}
                    >
                      {formatTimeAgo(item.createdAt, t)}
                    </p>
                  </div>
                </div>
              );
            })}
```

After the activity list, add the "Load More" button:

```tsx
        {hasMoreActivity && (
          <div className="flex justify-center pt-4">
            <button
              className="font-bold text-primary text-sm transition-colors hover:underline"
              onClick={() => loadActivity(true)}
              type="button"
            >
              {t("profile_load_more")}
            </button>
          </div>
        )}
```

- [ ] **Step 10: Commit**

```bash
git add src/pages/profile/index.tsx
git commit -m "feat: enhance profile page with multi-user view, avatar upload, enriched activity and sessions"
```

---

### Task 9: i18n — Add New Translation Keys

**Files:**
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Add all new keys to en.json**

Add these keys (in the appropriate sections — profile keys near existing profile keys, settings/users keys near existing user keys):

Profile section (after existing profile keys):

```json
  "profile_avatar_uploading": "Uploading avatar...",
  "profile_avatar_updated": "Avatar updated",
  "profile_avatar_removed": "Avatar removed",
  "profile_avatar_too_large": "Image must be smaller than 2MB",
  "profile_avatar_invalid_type": "Only JPEG, PNG, and WebP images are allowed",
  "profile_viewing_user": "{{name}}'s Profile",
  "profile_back_to_users": "Back to Users",
  "profile_login_time": "Login time",
  "profile_expires": "Expires",
  "profile_load_more": "Load More"
```

Settings/Users section (after existing user keys):

```json
  "add_user_modal_title": "Add Team Member",
  "add_user_modal_subtitle": "Create a new account for your team",
  "add_user_modal_username": "Username",
  "add_user_modal_email": "Email",
  "add_user_modal_password": "Password",
  "add_user_modal_role": "Role",
  "add_user_modal_submit": "Create User",
  "add_user_modal_error_username": "Username is required (min 3 characters)",
  "add_user_modal_error_email": "Valid email is required",
  "add_user_modal_error_password": "Password must be at least 8 characters",
  "add_user_modal_error_role": "Select a role",
  "add_user_modal_error_conflict": "Username or email already in use",
  "user_disabled": "{{name}} has been disabled",
  "user_enabled": "{{name}} has been enabled",
  "disable_user": "Disable user",
  "enable_user": "Enable user",
  "reset_password_title": "Reset Password",
  "reset_password_desc": "Set a new password for {{name}}. They will need to change it on next login.",
  "reset_password_new": "New Password",
  "reset_password_submit": "Reset Password",
  "reset_password_success": "Password has been reset"
```

- [ ] **Step 2: Sync locales**

```bash
pnpm run sync-locales
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/
git commit -m "feat: add i18n keys for unified user management"
```

---

### Task 10: Verify & Polish

- [ ] **Step 1: Run lint and typecheck**

```bash
pnpm run lint && pnpm run typecheck
```

Fix any issues.

- [ ] **Step 2: Run build**

```bash
pnpm run build
```

Fix any build errors.

- [ ] **Step 3: Manual QA — test in browser**

1. Log in as admin, go to Settings > Users tab.
2. Click "Add User" — fill form, verify user appears in list.
3. Toggle disable switch on a user — verify status changes.
4. Click Edit on a user — verify navigation to `/profile/:userId`.
5. On self profile, click avatar camera — upload image, verify it appears.
6. On self profile, verify sessions show login time.
7. On self profile, verify activity shows load more if applicable.
8. On another user's profile, verify "Back to Users" link works.
9. On another user's profile, verify Reset Password button works.
10. Check console for errors.
