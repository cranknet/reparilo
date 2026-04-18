import { Role } from "@shared/constants";
import { useEffect, useMemo } from "react";
import { useUsersStore } from "@/stores/users";

export function useTechnicians() {
  const users = useUsersStore((s) => s.users);
  const fetchUsers = useUsersStore((s) => s.fetchUsers);
  const isLoading = useUsersStore((s) => s.isLoading);

  useEffect(() => {
    if (users.length === 0) {
      fetchUsers();
    }
  }, [users.length, fetchUsers]);

  const technicians = useMemo(
    () =>
      users
        .filter((u) => u.role === Role.TECHNICIAN && u.isActive)
        .map((u) => ({ id: u.id, name: u.username })),
    [users]
  );

  return { isLoading, technicians };
}
