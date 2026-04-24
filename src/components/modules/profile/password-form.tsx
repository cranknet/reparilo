import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { INPUT_CLS, LABEL_CLS } from "@/components/modules/profile/shared";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const RE_UPPERCASE = /[A-Z]/;
const RE_DIGIT = /[0-9]/;
const RE_SPECIAL = /[^A-Za-z0-9]/;

const STRENGTH_COLORS = [
  "bg-error",
  "bg-tertiary",
  "bg-yellow-500",
  "bg-success",
];

const STRENGTH_LABELS = [
  "profile_strength_weak",
  "profile_strength_fair",
  "profile_strength_good",
  "profile_strength_strong",
];

function passwordStrength(pw: string): number {
  if (!pw) {
    return 0;
  }
  let score = 0;
  if (pw.length >= 8) {
    score++;
  }
  if (RE_UPPERCASE.test(pw)) {
    score++;
  }
  if (RE_DIGIT.test(pw)) {
    score++;
  }
  if (RE_SPECIAL.test(pw)) {
    score++;
  }
  return score;
}

interface PasswordFormProps {
  error?: string;
  form: {
    confirmPassword: string;
    currentPassword: string;
    newPassword: string;
  };
  formRef: React.RefObject<HTMLFormElement | null>;
  isDirty: boolean;
  isSubmitting: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onErrorChange: (error: string) => void;
  onFormChange: (form: {
    confirmPassword: string;
    currentPassword: string;
    newPassword: string;
  }) => void;
  onSubmit: (e: FormEvent) => void;
  onSuccessChange: (success: string) => void;
  success?: string;
}

export function PasswordForm({
  error,
  isSubmitting,
  onSubmit,
  success,
  form,
  onFormChange,
  onDirtyChange,
  formRef,
}: PasswordFormProps) {
  const { t } = useTranslation();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const prevNewPassword = useRef(form.newPassword);

  useEffect(() => {
    if (prevNewPassword.current && !form.newPassword) {
      setConfirmMismatch(false);
      setShowCurrentPassword(false);
      setShowNewPassword(false);
    }
    prevNewPassword.current = form.newPassword;
  }, [form.newPassword]);

  const strength = passwordStrength(form.newPassword);

  function handleConfirmBlur() {
    if (form.confirmPassword && form.confirmPassword !== form.newPassword) {
      setConfirmMismatch(true);
    } else {
      setConfirmMismatch(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit} ref={formRef}>
      <h4 className="font-bold text-on-surface text-sm uppercase tracking-wider">
        {t("profile_change_password")}
      </h4>

      {error && (
        <div
          aria-live="polite"
          className="rounded-lg bg-error-container p-4"
          role="alert"
        >
          <p className="font-bold text-on-error-container text-xs">{error}</p>
        </div>
      )}

      {success && (
        <div
          aria-live="polite"
          className="rounded-lg bg-primary-tint p-4"
          role="status"
        >
          <p className="font-bold text-success text-xs">{success}</p>
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label className={LABEL_CLS} htmlFor="current-password">
            {t("profile_current_password")}
          </label>
          <div className="relative">
            <input
              autoComplete="current-password"
              className={INPUT_CLS}
              id="current-password"
              onChange={(e) => {
                onFormChange({ ...form, currentPassword: e.target.value });
                onDirtyChange(true);
              }}
              placeholder="••••••••"
              type={showCurrentPassword ? "text" : "password"}
              value={form.currentPassword}
            />
            <button
              aria-label={
                showCurrentPassword
                  ? t("profile_hide_password")
                  : t("profile_show_password")
              }
              className="absolute end-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              type="button"
            >
              <Icon
                name={showCurrentPassword ? "visibility" : "visibility_off"}
                size="sm"
              />
            </button>
          </div>
        </div>

        <div>
          <label className={LABEL_CLS} htmlFor="new-password">
            {t("profile_new_password")}
          </label>
          <div className="relative">
            <input
              autoComplete="new-password"
              className={INPUT_CLS}
              id="new-password"
              onChange={(e) => {
                onFormChange({ ...form, newPassword: e.target.value });
                onDirtyChange(true);
                if (
                  confirmMismatch &&
                  form.confirmPassword === e.target.value
                ) {
                  setConfirmMismatch(false);
                }
              }}
              placeholder="••••••••"
              type={showNewPassword ? "text" : "password"}
              value={form.newPassword}
            />
            <button
              aria-label={
                showNewPassword
                  ? t("profile_hide_password")
                  : t("profile_show_password")
              }
              className="absolute end-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
              onClick={() => setShowNewPassword(!showNewPassword)}
              type="button"
            >
              <Icon
                name={showNewPassword ? "visibility" : "visibility_off"}
                size="sm"
              />
            </button>
          </div>
          {!form.newPassword && (
            <p className="mt-1.5 text-on-surface-variant text-xs">
              {t("profile_password_criteria")}
            </p>
          )}
          {form.newPassword && (
            <div
              aria-label={t(
                STRENGTH_LABELS[strength - 1] ?? "profile_strength_weak"
              )}
              aria-valuemax={4}
              aria-valuemin={0}
              aria-valuenow={strength}
              className="mt-2 space-y-1.5"
              role="progressbar"
            >
              <div className="flex gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    className={`h-1.5 flex-1 rounded-full transition-all ${i < strength ? (STRENGTH_COLORS[strength - 1] ?? "") : "bg-surface-container-high"}`}
                    key={i}
                  />
                ))}
              </div>
              <p className="font-bold text-on-surface-variant text-xs uppercase">
                {t(STRENGTH_LABELS[strength - 1] ?? "profile_strength_weak")}
              </p>
            </div>
          )}
        </div>

        <div>
          <label className={LABEL_CLS} htmlFor="confirm-password">
            {t("profile_confirm_password")}
          </label>
          <input
            aria-invalid={confirmMismatch}
            autoComplete="new-password"
            className={INPUT_CLS}
            id="confirm-password"
            onBlur={handleConfirmBlur}
            onChange={(e) => {
              onFormChange({ ...form, confirmPassword: e.target.value });
              onDirtyChange(true);
              if (confirmMismatch && e.target.value === form.newPassword) {
                setConfirmMismatch(false);
              }
            }}
            placeholder="••••••••"
            type="password"
            value={form.confirmPassword}
          />
          {confirmMismatch && (
            <p
              aria-live="polite"
              className="mt-1.5 font-bold text-error text-xs"
              role="alert"
            >
              {t("profile_password_mismatch")}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          icon="lock"
          loading={isSubmitting}
          type="submit"
          variant="primary"
        >
          {t("profile_update_password")}
        </Button>
      </div>
    </form>
  );
}
