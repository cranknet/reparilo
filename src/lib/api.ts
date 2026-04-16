import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "";

const api = axios.create({
  baseURL: `${baseURL}/api`,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

let csrfToken: string | null = null;
let csrfPromise: Promise<string | null> | null = null;

function fetchCsrfToken(): Promise<string | null> {
  if (csrfToken) {
    return Promise.resolve(csrfToken);
  }
  if (csrfPromise) {
    return csrfPromise;
  }

  csrfPromise = axios
    .get(`${baseURL}/api/csrf-token`, { withCredentials: true })
    .then((res) => {
      csrfToken = res.data.token;
      return csrfToken;
    })
    .catch(() => {
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
