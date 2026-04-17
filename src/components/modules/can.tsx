import type { PermissionCheck } from "@shared/permissions";
import type { ReactNode } from "react";
import { useCan } from "@/hooks/use-can";

interface CanProps {
  children: ReactNode;
  fallback?: ReactNode;
  perm: PermissionCheck;
}

export function Can({ perm, children, fallback = null }: CanProps) {
  const allowed = useCan(perm);
  return allowed ? children : fallback;
}
