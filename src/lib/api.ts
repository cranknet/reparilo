import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "";

const api = axios.create({
  baseURL: `${baseURL}/api`,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url ?? "";
      const authEndpoints = [
        "/auth/sign-in",
        "/auth/sign-out",
        "/auth/get-session",
        "/auth/change-password",
        "/auth/must-change-password",
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
