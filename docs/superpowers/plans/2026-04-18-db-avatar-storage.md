# DB Avatar Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace file-system avatar storage with base64 data URLs stored directly in the `image` column of the `User` table.

**Architecture:** The `uploadAvatar` service converts the uploaded file buffer to a base64 data URL string (`data:image/png;base64,...`) and writes it directly to the `User.image` column. The frontend uses `user.image` as the `<img src>` directly — data URLs are valid `src` values. No file system, no static serving for avatars, no 404s.

**Tech Stack:** Node.js Buffer → base64, existing Prisma `String?` column (no schema change needed), existing multipart upload.

---

### Task 1: Rewrite avatar.service.ts to store base64 in DB

**Files:**
- Modify: `server/services/avatar.service.ts`

The service currently writes files to disk and stores a relative path. We rewrite it to store a `data:` URL in the DB instead. Keep all existing validation (MIME type, magic bytes, size limit).

- [ ] **Step 1: Rewrite `uploadAvatar` to return a data URL**

Replace the full file content of `server/services/avatar.service.ts` with:

```ts
import type { PrismaClient } from "@prisma/client";

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024;

const MAGIC_BYTES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};

const WEBP_MARKER = [0x57, 0x45, 0x42, 0x50];

function validateMagicBytes(buffer: Buffer, mime: string): boolean {
  const expected = MAGIC_BYTES[mime];
  if (!expected) {
    return false;
  }
  const headerMatch = expected.every((byte, i) => buffer[i] === byte);
  if (!headerMatch) {
    return false;
  }
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });
  if (!user) {
    return null;
  }

  const dataUrl = `data:${file.mimetype};base64,${buffer.toString("base64")}`;

  await prisma.user.update({
    where: { id: userId },
    data: { image: dataUrl },
  });

  return { image: dataUrl };
}

export async function deleteAvatar(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true },
  });
  if (!user) {
    return null;
  }
  if (!user.image) {
    return { image: null };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { image: null },
  });

  return { image: null };
}
```

Key changes:
- Removed `crypto`, `fs`, `path` imports — no file system operations
- `uploadAvatar` converts buffer to `data:${mime};base64,${base64}` and stores in DB directly
- `deleteAvatar` just sets `image: null` — no file to unlink
- Removed `UPLOAD_DIR`, `extFromMime`, and all file system code

- [ ] **Step 2: Verify the server starts**

Run: `pnpm run server` (or just check it compiles with `npx tsc --noEmit`)
Expected: No type errors related to avatar.service.ts

- [ ] **Step 3: Commit**

```bash
git add server/services/avatar.service.ts
git commit -m "refactor: store avatar as base64 data URL in DB instead of file system"
```

---

### Task 2: Update frontend to use `user.image` directly as `src`

**Files:**
- Modify: `src/pages/profile/index.tsx` (lines 814-821)
- Modify: `src/pages/settings/index.tsx` (line 113)

Now that `user.image` is a `data:image/...;base64,...` URL (or `null`), the frontend no longer needs the `/api/uploads/` prefix. The `src` should just be `displayUser.image` / `user.image` directly.

- [ ] **Step 1: Update profile page avatar `src`**

In `src/pages/profile/index.tsx`, replace the `src` prop (around line 814):

From:
```tsx
              src={
                displayUser.image
                  ? displayUser.image.startsWith("http") ||
                    displayUser.image.startsWith("blob:")
                    ? displayUser.image
                    : `/api/uploads/${displayUser.image}`
                  : undefined
              }
```

To:
```tsx
              src={displayUser.image ?? undefined}
```

The logic simplifies because:
- `displayUser.image` is now either a `data:` URL (from DB), a `blob:` URL (local preview), or `null`
- All of these are valid `<img src>` values or `undefined` (falls back to initials)

- [ ] **Step 2: Update settings page avatar `src`**

In `src/pages/settings/index.tsx`, replace line 113:

From:
```tsx
        src={user.image ? `/api/uploads/${user.image}` : undefined}
```

To:
```tsx
        src={user.image ?? undefined}
```

- [ ] **Step 3: Verify no other `/api/uploads/` references for avatars**

Run: `grep -rn "/api/uploads/" src/`
Expected: No remaining references (job photos use a different mechanism)

- [ ] **Step 4: Commit**

```bash
git add src/pages/profile/index.tsx src/pages/settings/index.tsx
git commit -m "refactor: use user.image directly as avatar src (data URL)"
```

---

### Task 3: Simplify `use-profile-multi-user.ts` — remove `localImage` optimistic preview complexity

**Files:**
- Modify: `src/hooks/use-profile-multi-user.ts`

The `localImage` state was needed to show an optimistic preview via `URL.createObjectURL()` while the upload was in flight. Since the upload now returns a data URL immediately in the response, and `checkSession(true)` fetches it right after, we can simplify: use the upload response's `image` value as the optimistic preview, then let `checkSession` confirm it.

- [ ] **Step 1: Simplify the hook**

Replace the full file content of `src/hooks/use-profile-multi-user.ts` with:

```ts
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

interface DisplayUser {
  email: string;
  id: string;
  image: string | null;
  name: string;
  role: string;
  username: string;
}

const EMPTY_USER: DisplayUser = {
  email: "",
  id: "",
  image: null,
  name: "",
  role: "",
  username: "",
};

export function useProfileMultiUser(role: string) {
  const { userId: routeUserId } = useParams<{ userId?: string }>();
  const user = useAuthStore((s) => s.user);
  const checkSession = useAuthStore((s) => s.checkSession);
  const isSelf = !routeUserId || routeUserId === user?.id;
  const userId = isSelf ? user?.id : routeUserId;

  const [targetUser, setTargetUser] = useState<DisplayUser | null>(null);

  useEffect(() => {
    if (!isSelf && routeUserId) {
      api
        .get(`/users/${routeUserId}`)
        .then((res) => setTargetUser(res.data))
        .catch(() => setTargetUser(null));
    } else {
      setTargetUser(null);
    }
  }, [isSelf, routeUserId]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const displayUser: DisplayUser = isSelf
    ? {
        email: user?.email || "",
        id: user?.id || "",
        image: previewImage ?? user?.image ?? null,
        name: user?.name || user?.username || "",
        role,
        username: user?.username || "",
      }
    : (targetUser ?? { ...EMPTY_USER, id: routeUserId || "" });

  async function handleAvatarUpload(
    file: File,
    onError: (msg: string) => void
  ) {
    if (!(isSelf && userId)) {
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    setAvatarUploading(true);
    try {
      const res = await api.post(`/users/${userId}/avatar`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreviewImage(res.data.image);
      await checkSession(true);
      setPreviewImage(null);
    } catch (err: unknown) {
      setPreviewImage(null);
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const errorMsg = axiosErr.response?.data?.error;
      if (errorMsg === "FILE_TOO_LARGE") {
        onError("profile_avatar_too_large");
      } else if (
        errorMsg === "INVALID_FILE_TYPE" ||
        errorMsg === "INVALID_FILE_CONTENT"
      ) {
        onError("profile_avatar_invalid_type");
      } else {
        onError("profile_avatar_upload_failed");
      }
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleAvatarRemove() {
    if (!(isSelf && userId)) {
      return;
    }
    setPreviewImage(null);
    try {
      await api.delete(`/users/${userId}/avatar`);
      await checkSession(true);
    } catch {
      // error handled by interceptor
    }
  }

  return {
    avatarUploading,
    displayUser,
    fileInputRef,
    handleAvatarRemove,
    handleAvatarUpload,
    isSelf,
    userId,
  };
}
```

Key changes:
- Renamed `localImage` → `previewImage` for clarity
- Removed `URL.createObjectURL(file)` — the upload response now contains the data URL, so we use `res.data.image` as the preview
- The flow: upload → server returns data URL → show as preview → `checkSession(true)` confirms → clear preview

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-profile-multi-user.ts
git commit -m "refactor: use upload response data URL as avatar preview instead of blob URL"
```

---

### Task 4: Remove `/api/uploads/` static serving for avatars (keep for job photos)

**Files:**
- Modify: `server/index.ts`

The static serving at `/api/uploads/` is still needed for **job photos** (`uploads/job-photos/`). However, we should ensure the `uploads/avatars/` directory is no longer being served or written to. Since the static plugin serves from `uploads/` root and avatars are no longer written there, this is already handled. But we should clean up.

- [ ] **Step 1: Delete orphaned avatar files on disk**

Run: `rm -rf uploads/avatars/`

This removes all previously file-system-stored avatars. They are no longer needed since the DB now holds the data URLs.

- [ ] **Step 2: Verify job photos still work**

Run the server and create/view a job with a photo. The `/api/uploads/job-photos/...` path should still work because `@fastify/static` still serves from `uploads/`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove orphaned file-system avatar files"
```

---

### Task 5: QA — full avatar flow in browser

**Files:** None (manual testing)

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Test upload**

1. Login as any user
2. Go to Profile
3. Upload a new avatar
4. Verify: avatar appears immediately (data URL)
5. Check browser console: no 404 errors

- [ ] **Step 3: Test remove**

1. Click remove avatar
2. Verify: falls back to initials circle
3. Check browser console: no errors

- [ ] **Step 4: Test re-upload after remove**

1. Upload a different avatar
2. Verify: new avatar appears immediately
3. Check browser console: no 404 errors, no stale image

- [ ] **Step 5: Test settings page**

1. Navigate to Settings
2. Verify: user card shows avatar correctly (data URL)
3. Check browser console: no errors

- [ ] **Step 6: Collect and flag any console errors**

Check the browser DevTools console for any errors or warnings during the above flows.
