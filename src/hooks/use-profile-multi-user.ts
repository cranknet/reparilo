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
  const currentUser = useAuthStore((s) => s.user);
  const user = useAuthStore((s) => s.user);
  const checkSession = useAuthStore((s) => s.checkSession);
  const isSelf = !routeUserId || routeUserId === currentUser?.id;
  const userId = isSelf ? currentUser?.id : routeUserId;

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

  const displayUser: DisplayUser = isSelf
    ? {
        email: user?.email || "",
        id: user?.id || "",
        image: (user as typeof user & { image?: string | null })?.image ?? null,
        name: user?.name || user?.username || "",
        role,
        username: user?.username || "",
      }
    : (targetUser ?? { ...EMPTY_USER, id: routeUserId || "" });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  async function handleAvatarUpload(
    file: File,
    onError: (msg: string) => void
  ) {
    if (!isSelf) {
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    setAvatarUploading(true);
    try {
      await api.post(`/users/${userId}/avatar`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await checkSession(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const errorMsg = axiosErr.response?.data?.error;
      if (errorMsg === "FILE_TOO_LARGE") {
        onError("profile_avatar_too_large");
      } else if (errorMsg === "INVALID_FILE_TYPE") {
        onError("profile_avatar_invalid_type");
      }
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleAvatarRemove() {
    if (!isSelf) {
      return;
    }
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
