import type { Job } from "@shared/types";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";

interface JobPhotosSectionProps {
  job: Job;
  onChanged?: () => void;
}

export default function JobPhotosSection({
  job,
  onChanged,
}: JobPhotosSectionProps) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const photos = job.photos ?? [];

  if (photos.length === 0) {
    return null;
  }

  const photoUrl = (path: string) => `${api.defaults.baseURL}/uploads/${path}`;

  const handleDelete = async (photoId: string) => {
    setDeleting(photoId);
    try {
      await api.delete(`/jobs/${job.id}/photos/${photoId}`);
      onChanged?.();
    } catch {
      // handled by interceptor
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <h2 className="mb-4 font-bold font-headline text-base text-on-surface">
        {t("intake.device_photos")}
      </h2>
      <div className="flex flex-wrap gap-3">
        {photos.map((photo) => (
          <div
            className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-xl ring-1 ring-outline-variant"
            key={photo.id}
          >
            <button
              className="h-full w-full"
              onClick={() => setLightboxUrl(photoUrl(photo.path))}
              type="button"
            >
              <img
                alt={t("intake.device_photos")}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                height={96}
                loading="lazy"
                src={photoUrl(photo.path)}
                width={96}
              />
            </button>
            <button
              aria-label={t("intake.remove_photo")}
              className="absolute inset-0 flex items-center justify-center bg-on-surface/50 opacity-0 transition-opacity group-hover:opacity-100"
              disabled={deleting === photo.id}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(photo.id);
              }}
              type="button"
            >
              {deleting === photo.id ? (
                <span className="material-symbols-outlined animate-spin text-lg text-on-primary">
                  progress_activity
                </span>
              ) : (
                <span className="material-symbols-outlined text-lg text-on-primary">
                  delete
                </span>
              )}
            </button>
          </div>
        ))}
      </div>

      {lightboxUrl && (
        <button
          aria-label={t("close_modal")}
          className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/60"
          onClick={() => setLightboxUrl(null)}
          type="button"
        >
          {/* biome-ignore lint/correctness/useImageSize: lightbox image uses CSS sizing */}
          <img
            alt={t("intake.device_photos")}
            className="max-h-[85vh] max-w-[90vw] rounded-xl shadow-2xl"
            src={lightboxUrl}
          />
        </button>
      )}
    </>
  );
}
