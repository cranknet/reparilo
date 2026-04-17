import { ac, roles } from "@shared/permissions";
import { adminClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL:
    typeof window === "undefined"
      ? undefined
      : `${window.location.protocol}//${window.location.host}`,
  basePath: "/api/auth",
  plugins: [usernameClient(), adminClient({ ac, roles })],
});

export type AuthClient = typeof authClient;
