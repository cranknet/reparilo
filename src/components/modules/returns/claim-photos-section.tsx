import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useCan } from "@/hooks/use-can";
import {
  useDeleteClaimPhoto,
  useUploadClaimPhoto,
} from "@/hooks/use-return-claims";
import type { PhotoStage, ReturnClaimDetail } from "@/types/return-claim";

interface Props {
  claim: ReturnClaimDetail;
}

const STAGES: PhotoStage[] = ["RETURN_INTAKE", "RETURN_RESOLUTION"];

export default function ClaimPhotosSection({ claim }: Props) {
  const { t } = useTranslation();
  const canEdit = useCan({ returns: ["edit"] });
  const upload = useUploadClaimPhoto(claim.id);
  const remove = useDeleteClaimPhoto(claim.id);
  const intakeRef = useRef<HTMLInputElement>(null);
  const resolutionRef = useRef<HTMLInputElement>(null);

  const photosByStage: Record<PhotoStage, typeof claim.photos> = {
    RETURN_INTAKE: claim.photos.filter((p) => p.stage === "RETURN_INTAKE"),
    RETURN_RESOLUTION: claim.photos.filter(
      (p) => p.stage === "RETURN_RESOLUTION"
    ),
  };

  const handleUpload = async (stage: PhotoStage, file: File) => {
    await upload.mutateAsync({ file, stage });
    toast.success(t("returns_toast_photo_added"));
  };

  return (
    <section className="space-y-4 rounded-lg border border-outline-variant bg-surface-container p-4">
      <h2 className="font-medium text-on-surface">
        {t("returns_photos_title")}
      </h2>

      {STAGES.map((stage) => {
        const ref = stage === "RETURN_INTAKE" ? intakeRef : resolutionRef;
        const list = photosByStage[stage];
        return (
          <div className="space-y-2" key={stage}>
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-on-surface-variant text-sm">
                {stage === "RETURN_INTAKE"
                  ? t("returns_photos_intake")
                  : t("returns_photos_resolution")}
              </h3>
              {canEdit && claim.status === "OPEN" && (
                <>
                  <input
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        handleUpload(stage, f);
                      }
                      e.target.value = "";
                    }}
                    ref={ref}
                    type="file"
                  />
                  <button
                    className="rounded border border-outline-variant px-2.5 py-1 text-xs"
                    onClick={() => ref.current?.click()}
                    type="button"
                  >
                    {t("returns_photos_add")}
                  </button>
                </>
              )}
            </div>

            {list.length === 0 ? (
              <p className="text-on-surface-variant text-sm">
                {stage === "RETURN_INTAKE"
                  ? t("returns_photos_empty_intake")
                  : t("returns_photos_empty_resolution")}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
                {list.map((p) => (
                  <div className="relative" key={p.id}>
                    <img
                      alt=""
                      className="aspect-square w-full rounded object-cover"
                      height={128}
                      src={`/api/uploads/${p.path}`}
                      width={128}
                    />
                    {canEdit && claim.status === "OPEN" && (
                      <button
                        aria-label="remove"
                        className="absolute top-1 right-1 rounded-full bg-error p-1 text-on-error"
                        onClick={async () => {
                          await remove.mutateAsync(p.id);
                          toast.success(t("returns_toast_photo_removed"));
                        }}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-xs">
                          close
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
