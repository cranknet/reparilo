import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "";

const api = axios.create({
  baseURL: `${baseURL}/api`,
  timeout: 15_000,
  withCredentials: true,
});

let csrfToken: string | null = null;
let csrfPromise: Promise<string | null> | null = null;

// Consecutive-failure counter for CSRF token fetch
let csrfFetchFailures = 0;
let csrfCooldownUntil = 0;
const CSRF_FAILURE_THRESHOLD = 3;
const CSRF_COOLDOWN_MS = 30_000;

function fetchCsrfToken(): Promise<string | null> {
  if (csrfToken) {
    return Promise.resolve(csrfToken);
  }

  // Check if we're in cooldown after repeated failures
  if (Date.now() < csrfCooldownUntil) {
    return Promise.resolve(null);
  }
  // Cooldown expired — reset
  if (csrfCooldownUntil > 0) {
    csrfFetchFailures = 0;
    csrfCooldownUntil = 0;
  }

  if (csrfPromise) {
    return csrfPromise;
  }

  csrfPromise = axios
    .get(`${baseURL}/api/csrf-token`, { withCredentials: true })
    .then((res) => {
      csrfFetchFailures = 0;
      csrfToken = res.data.token;
      return csrfToken;
    })
    .catch(() => {
      csrfFetchFailures += 1;
      if (csrfFetchFailures >= CSRF_FAILURE_THRESHOLD) {
        csrfCooldownUntil = Date.now() + CSRF_COOLDOWN_MS;
      }
      return null;
    })
    .finally(() => {
      csrfPromise = null;
    });

  return csrfPromise;
}

const MUTATION_METHODS = new Set(["post", "put", "patch", "delete"]);

api.interceptors.request.use(async (config) => {
  if (MUTATION_METHODS.has(config.method?.toLowerCase() ?? "")) {
    const token = await fetchCsrfToken();
    if (token) {
      config.headers["X-CSRF-Token"] = token;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403) {
      const message: string = error.response?.data?.message ?? "";
      if (message.toLowerCase().includes("csrf")) {
        csrfToken = null;
        const originalRequest = error.config;
        if (!originalRequest._csrfRetry) {
          originalRequest._csrfRetry = true;
          const token = await fetchCsrfToken();
          if (token) {
            originalRequest.headers["X-CSRF-Token"] = token;
            return api(originalRequest);
          }
        }
      }
    }

    if (error.response?.status === 401) {
      const url = error.config?.url ?? "";
      const authEndpoints = [
        "/auth/sign-in",
        "/auth/sign-out",
        "/auth/get-session",
        "/auth/change-password",
        "/auth/must-change-password",
        "/auth/request-password-reset",
        "/auth/reset-password",
      ];
      const isAuthEndpoint = authEndpoints.some((ep) => url.includes(ep));
      if (!isAuthEndpoint) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
