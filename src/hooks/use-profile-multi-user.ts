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
  const user = useAuthStore((s) => s.user);
  const updateUserImage = useAuthStore((s) => s.updateUser);
  const isSelf = !routeUserId || routeUserId === user?.id;
  const userId = isSelf ? user?.id : routeUserId;

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [localImage, setLocalImage] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Revoke blob URL on unmount to prevent memory leaks
  useEffect(
    () => () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    },
    []
  );

  const displayUser: DisplayUser = isSelf
    ? {
        email: user?.email || "",
        id: user?.id || "",
        image: localImage ?? user?.image ?? null,
        name: user?.name || user?.username || "",
        role,
        username: user?.username || "",
      }
    : (targetUser ?? { ...EMPTY_USER, id: routeUserId || "" });

  async function handleAvatarUpload(
    file: File,
    onError: (msg: string) => void
  ) {
    if (!(isSelf && userId)) {
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    const blobUrl = URL.createObjectURL(file);
    blobUrlRef.current = blobUrl;
    setLocalImage(blobUrl);
    setAvatarUploading(true);
    try {
      const res = await api.post(`/users/${userId}/avatar`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setLocalImage(null);
      updateUserImage({ image: res.data.image });
    } catch (err: unknown) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setLocalImage(null);
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const errorMsg = axiosErr.response?.data?.error;
      if (errorMsg === "FILE_TOO_LARGE") {
        onError("profile_avatar_too_large");
      } else if (
        errorMsg === "INVALID_FILE_TYPE" ||
        errorMsg === "INVALID_FILE_CONTENT"
      ) {
        onError("profile_avatar_invalid_type");
      } else {
        onError("profile_avatar_upload_failed");
      }
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleAvatarRemove() {
    if (!(isSelf && userId)) {
      return;
    }
    try {
      await api.delete(`/users/${userId}/avatar`);
      setLocalImage(null);
      updateUserImage({ image: null });
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
