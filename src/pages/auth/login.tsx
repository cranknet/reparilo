import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        window.location.href = "/";
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex h-screen w-full overflow-hidden bg-background font-body text-on-surface antialiased">
      <section
        className={`blueprint-pattern relative hidden items-center justify-center overflow-hidden lg:flex lg:w-1/2 ${isRtl ? "lg:order-2" : ""}`}
      >
        <div className="relative z-10 max-w-2xl px-16">
          <div className="mb-8">
            <span className="rounded-full border border-primary-container/50 bg-primary-container/30 px-4 py-1.5 font-label font-semibold text-on-primary-container text-xs uppercase tracking-widest">
              {t("auth_precision_engine")}
            </span>
          </div>
          <h1 className="mb-6 font-extrabold font-headline text-5xl text-white leading-tight">
            {t("auth_engineering_atelier")} <br />
            <span className="text-primary-fixed">{t("auth_atelier")}</span>
          </h1>
          <p className="mb-10 font-light text-lg text-primary-fixed-dim leading-relaxed">
            {t("auth_hero_desc")}
          </p>
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-xl border border-outline-variant/10 bg-primary-container/20 p-6 backdrop-blur-md">
              <span className="material-symbols-outlined mb-3 block font-bold font-headline text-primary-fixed text-xl">
                precision_manufacturing
              </span>
              <div className="font-bold font-headline text-white text-xl">
                {t("auth_intake")}
              </div>
              <div className="mt-1 text-primary-fixed-dim text-sm">
                {t("auth_intake_desc")}
              </div>
            </div>
            <div className="rounded-xl border border-outline-variant/10 bg-primary-container/20 p-6 backdrop-blur-md">
              <span className="material-symbols-outlined mb-3 block font-bold font-headline text-primary-fixed text-xl">
                build
              </span>
              <div className="font-bold font-headline text-white text-xl">
                {t("auth_metrics")}
              </div>
              <div className="mt-1 text-primary-fixed-dim text-sm">
                {t("auth_metrics_desc")}
              </div>
            </div>
          </div>
        </div>
        <div
          className={`absolute bottom-10 flex items-center gap-4 text-primary-fixed/40 ${isRtl ? "right-16" : "left-16"}`}
        >
          <span className="font-bold font-headline text-2xl tracking-tighter">
            Reparilo
          </span>
          <span className="h-[1px] w-12 bg-primary-fixed/20" />
          <span className="font-label text-[10px] uppercase tracking-[0.3em]">
            {t("app_tagline")}
          </span>
        </div>
      </section>

      <section
        className={`flex w-full flex-col overflow-y-auto bg-surface lg:w-1/2 ${isRtl ? "lg:order-1" : ""}`}
      >
        <div className="flex items-center justify-between px-8 py-6 lg:hidden">
          <div>
            <h1 className="font-bold font-headline text-primary text-xl tracking-tighter">
              Reparilo
            </h1>
            <p className="font-bold text-[10px] text-slate-500 uppercase tracking-widest">
              {t("app_tagline")}
            </p>
          </div>
        </div>

        <div className="flex flex-grow items-center justify-center p-8 md:p-16">
          <div className="w-full max-w-md">
            <div className="mb-10">
              <h2 className="mb-2 font-extrabold font-headline text-3xl text-on-surface">
                {t("auth_access_portal")}
              </h2>
              <p className="font-medium text-on-surface-variant">
                {t("auth_identify")}
              </p>
              <div className="mt-8 flex rounded-xl bg-surface-container-high p-1">
                <button
                  className={`flex-1 rounded-lg py-2.5 font-semibold text-sm transition-all duration-200 ${
                    mode === "signin"
                      ? "bg-surface-container-lowest text-primary shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                  onClick={() => setMode("signin")}
                  type="button"
                >
                  {t("auth_sign_in")}
                </button>
                <button
                  className={`flex-1 rounded-lg py-2.5 font-semibold text-sm transition-all duration-200 ${
                    mode === "signup"
                      ? "bg-surface-container-lowest text-primary shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                  onClick={() => setMode("signup")}
                  type="button"
                >
                  {t("auth_create_account")}
                </button>
              </div>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label
                  className="font-bold font-label text-on-surface-variant text-xs uppercase tracking-wider"
                  htmlFor="username"
                >
                  {t("auth_username")}
                </label>
                <div className="group relative">
                  <span className="material-symbols-outlined absolute top-1/2 left-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary">
                    person
                  </span>
                  <input
                    autoComplete="username"
                    className="w-full rounded-xl bg-surface-container-highest py-4 pr-4 pl-12 font-medium transition-all placeholder:text-slate-400 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                    id="username"
                    name="username"
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("auth_username_placeholder")}
                    required
                    type="text"
                    value={username}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    className="font-bold font-label text-on-surface-variant text-xs uppercase tracking-wider"
                    htmlFor="password"
                  >
                    {t("auth_password")}
                  </label>
                  <span className="cursor-pointer font-semibold text-primary text-xs transition-all hover:underline">
                    {t("auth_forgot_password")}
                  </span>
                </div>
                <div className="group relative">
                  <span className="material-symbols-outlined absolute top-1/2 left-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary">
                    lock
                  </span>
                  <input
                    autoComplete="current-password"
                    className="w-full rounded-xl bg-surface-container-highest py-4 pr-12 pl-12 transition-all placeholder:text-slate-400 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                    id="password"
                    name="password"
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth_password_placeholder")}
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button
                    aria-label={
                      showPassword
                        ? t("auth_hide_password")
                        : t("auth_show_password")
                    }
                    className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400 transition-colors hover:text-on-surface"
                    onClick={() => setShowPassword((v) => !v)}
                    type="button"
                  >
                    <span className="material-symbols-outlined">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              <button
                className="atelier-gradient flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold font-headline text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
                type="submit"
              >
                <span>
                  {loading ? t("auth_signing_in") : t("auth_sign_in")}
                </span>
                {!loading && (
                  <span className="material-symbols-outlined text-lg">
                    arrow_forward
                  </span>
                )}
              </button>
            </form>

            <div className="mt-12 text-center">
              <p className="text-on-surface-variant text-xs leading-relaxed">
                {t("auth_terms")} <br />
                <span className="cursor-pointer font-bold text-primary hover:underline">
                  {t("auth_terms_link")}
                </span>{" "}
                {t("auth_and")}{" "}
                <span className="cursor-pointer font-bold text-primary hover:underline">
                  {t("auth_privacy")}
                </span>
                .
              </p>
            </div>
          </div>
        </div>

        <footer className="mt-auto flex items-center justify-between border-transparent border-t bg-surface-container-low p-8">
          <div className="font-bold font-label text-[10px] text-slate-400 uppercase tracking-widest">
            {t("auth_copyright")}
          </div>
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5 font-bold font-label text-[10px] text-slate-400 uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {t("auth_system_status")}
            </span>
          </div>
        </footer>
      </section>

      <div className="pointer-events-none fixed top-0 right-0 -z-10 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl lg:hidden" />
      <div className="pointer-events-none fixed bottom-0 left-0 -z-10 h-64 w-64 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary/5 blur-3xl lg:hidden" />
    </main>
  );
}
