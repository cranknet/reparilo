# Unified User Management System

**Date:** 2026-04-17
**Status:** Approved
**Approach:** A — Profile page as multi-user viewer

## Summary

Create a single-source user management system where Settings > Users is the list/management hub and Profile becomes the detail/edit view for any user (self or others). Add avatar upload, enriched activity history, enriched sessions, and wire up the Add User modal.

## Routing

| Route | Description |
|---|---|
| `/profile` | Self profile (no param) |
| `/profile/:userId` | Another user's profile (admin/owner, requires `users:read`) |
| `/settings` (Users tab) | User list + Add User modal + disable toggle + Edit link |

Profile page reads `userId` from route params. If absent, uses current user's ID. A `useEffect` fetches target user data on mount.

## Profile Page Changes

### Avatar

- Replace static initials circle with existing `<Avatar>` component from `src/components/ui/avatar.tsx`, passing `src={user.image}` and `initials`.
- "Change Avatar" button triggers hidden `<input type="file" accept="image/*">`. On file select, upload via `POST /users/:id/avatar` (multipart/form-data). On success, update user store and refresh session if self.
- Self-only feature — hidden when viewing another user.
- Remove avatar: `DELETE /users/:id/avatar`.

### Activity History (Enriched)

- Job code links: when audit log metadata contains a `jobId` or `toValue` references a job, render as a link to `/jobs?highlight=<id>`.
- Full timestamp: show on hover via `title` attribute on the relative time.
- Pagination: "View Full History" button appends older entries using cursor-based pagination (`?cursor=<lastId>`).
- Admin viewing another user sees that user's audit trail (already supported by `GET /users/:id/activity`).

### Active Sessions (Enriched)

- Show login time (`createdAt`) formatted as date + time.
- Show session expiry info.
- Show IP address with label.
- Admin can view other users' sessions (backend change required to relax self-only restriction for `users:write`).

### Conditional Behavior (Self vs Other)

| Tab | Self | Other User (Admin) |
|---|---|---|
| Personal | Full edit | Full edit |
| Security | Password change + sessions | Reset Password modal + view sessions (admin) |
| Activity | Own activity | Target user's activity |

When viewing another user:
- Page title shows their name, not "My Profile".
- Sidebar stats show their completed/monthly jobs.
- Back button returns to Settings > Users.

## Settings > Users Tab

### Add User Modal

Pattern: follows `add-part-modal.tsx` (overlay → centered card → header + form + footer).

Fields:
- Username (required)
- Email (required)
- Password (required)
- Role (select: OWNER / TECHNICIAN / FRONT_DESK)

Validates via existing `createUserSchema` from `@shared/schemas/auth.schema`. Calls `useUsersStore.createUser()`.

### User List Enhancements

- Avatar thumbnail via `<Avatar>` component.
- Disable/Enable toggle: inline switch (same as add-part-modal's active toggle pattern). Calls `useUsersStore.toggleUserStatus()`.
- Edit button: navigates to `/profile/:userId`.
- Role badge: existing `ROLE_CONFIG` badges.
- Status badge: existing active/inactive indicator.
- No delete — disable only.

## Backend Changes

### New Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/users/:id/avatar` | self or `users:write` | Multipart upload, save to local disk (`uploads/avatars/`), update `User.image` |
| DELETE | `/users/:id/avatar` | self or `users:write` | Remove file from disk, set `User.image` to null |

Avatar storage: files saved to `uploads/avatars/<userId>_<timestamp>.<ext>`, path stored in `User.image`. Max file size 2MB, accepted types: image/jpeg, image/png, image/webp.

### Modified Endpoints

| Method | Path | Change |
|---|---|---|
| GET | `/users` | Add `image` to select fields |
| GET | `/users/:id/sessions` | Allow `users:write` role to view any user's sessions (currently self-only) |
| GET | `/users/:id/activity` | Add cursor-based pagination support (`?cursor=&limit=20`) |

### Avatar Upload Details

- Use `@fastify/multipart` (check if already registered, otherwise add).
- Save to `uploads/avatars/` directory.
- Validate: max 2MB, jpeg/png/webp only.
- Update `User.image` with relative path.
- Return `{ image: string }`.

## Store Changes

### `src/stores/users.ts`

- Add `updateUserAvatar(id: string, imagePath: string)`: updates the user in the local `users` array.

### `src/stores/auth.ts`

- After avatar upload for self, call `checkSession(true)` to refresh `user.image`.

## i18n Keys (New)

Profile:
- `profile_avatar_uploading` — "Uploading..."
- `profile_avatar_updated` — "Avatar updated"
- `profile_avatar_removed` — "Avatar removed"
- `profile_avatar_too_large` — "Image must be smaller than 2MB"
- `profile_avatar_invalid_type` — "Only JPEG, PNG, and WebP images are allowed"
- `profile_viewing_user` — "{{name}}'s Profile"
- `profile_back_to_users` — "Back to Users"
- `profile_login_time` — "Login time"
- `profile_expires` — "Expires"
- `profile_load_more` — "Load More"

Settings/Users:
- `add_user_modal_title` — "Add Team Member"
- `add_user_modal_subtitle` — "Create a new account for your team"
- `add_user_modal_username` — "Username"
- `add_user_modal_email` — "Email"
- `add_user_modal_password` — "Password"
- `add_user_modal_role` — "Role"
- `add_user_modal_submit` — "Create User"
- `add_user_modal_error_username` — "Username is required"
- `add_user_modal_error_email` — "Valid email is required"
- `add_user_modal_error_password` — "Password must be at least 6 characters"
- `add_user_modal_error_role` — "Select a role"
- `add_user_modal_error_conflict` — "Username or email already in use"
- `user_disabled` — "{{name}} has been disabled"
- `user_enabled` — "{{name}} has been enabled"
- `reset_password_title` — "Reset Password"
- `reset_password_desc` — "Set a new password for {{name}}. They will need to change it on next login."
- `reset_password_new` — "New Password"
- `reset_password_submit` — "Reset Password"
- `reset_password_success` — "Password has been reset"

## Files to Create/Modify

### New Files
- `src/components/modules/settings/add-user-modal.tsx` — Add User dialog
- `src/components/modules/settings/reset-password-modal.tsx` — Reset Password dialog

### Modified Files
- `src/pages/profile/index.tsx` — Multi-user support, avatar, enriched activity/sessions
- `src/pages/settings/index.tsx` — Wire up Add User modal, disable toggle, edit navigation
- `src/pages/settings/` — May split users section into separate component
- `server/routes/users.ts` — Avatar upload/delete endpoints, session visibility change, activity pagination
- `src/stores/users.ts` — Avatar update action
- `src/stores/auth.ts` — Refresh after avatar upload
- `src/App.tsx` — Add `/profile/:userId` route
- `src/i18n/locales/en.json` — New translation keys (then sync-locales)

## Out of Scope

- IP geolocation API calls (just show raw IP).
- Email verification on avatar change.
- Profile page for non-admin users viewing others (blocked by permission).
- Avatar cropping/resizing (use CSS `object-cover`).
