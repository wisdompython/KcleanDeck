"use client";

import { useMutation } from "@tanstack/react-query";
import { ImagePlus, TriangleAlert, Trash2 } from "lucide-react";
import { useRef } from "react";

import { Button, ErrorNote, useToast } from "@/components/admin/ui";
import { api } from "@/lib/admin/api";

const SHARP_WIDTH = 1600;

/**
 * Upload / replace / remove the photo of a service or category. The backend
 * resizes uploads into WebP; we warn when the original is too small to look
 * sharp on large screens.
 */
export function PhotoUploader<T extends { photo_url: string; has_photo: boolean; photo_width: number }>({
  endpoint,
  entity,
  disabled = false,
  onSaved,
  aspect = "aspect-[16/10]",
}: {
  /** e.g. "services/12/photo/"; undefined until the item has been saved. */
  endpoint?: string;
  entity: T;
  disabled?: boolean;
  onSaved: (updated: T) => void;
  aspect?: string;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("photo", file);
      return api<T>(endpoint!, { method: "POST", body: form });
    },
    onSuccess: (updated) => {
      onSaved(updated);
      toast("Photo uploaded");
    },
  });
  const remove = useMutation({
    mutationFn: () => api<T>(endpoint!, { method: "DELETE" }),
    onSuccess: (updated) => {
      onSaved(updated);
      toast("Photo removed");
    },
  });

  const lowRes = entity.has_photo && entity.photo_width > 0 && entity.photo_width < SHARP_WIDTH;

  return (
    <div>
      <div className={`relative ${aspect} overflow-hidden rounded-xl border border-surface-container-high bg-surface-container`}>
        {entity.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entity.photo_url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-sm text-outline">No photo yet</div>
        )}
        {upload.isPending && (
          <div className="absolute inset-0 grid place-items-center bg-primary/50 text-sm font-semibold text-white">
            Uploading and resizing…
          </div>
        )}
      </div>

      {!entity.has_photo && entity.photo_url && (
        <p className="mt-2 text-xs text-outline">Showing the starter photo from the website. Upload your own to replace it.</p>
      )}
      {lowRes && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-on-warning-container">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          This photo is {entity.photo_width}px wide and may look soft on large screens. Use one at least {SHARP_WIDTH}px
          wide.
        </p>
      )}

      {endpoint ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Photo file"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="subtle" disabled={disabled} loading={upload.isPending} onClick={() => input.current?.click()}>
            <ImagePlus className="size-4" /> {entity.has_photo ? "Replace photo" : "Upload photo"}
          </Button>
          {entity.has_photo && (
            <Button size="sm" variant="danger" disabled={disabled} loading={remove.isPending} onClick={() => remove.mutate()}>
              <Trash2 className="size-4" /> Remove
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-outline">Save first, then you can upload a photo.</p>
      )}
      <p className="mt-2 text-xs text-outline">JPG, PNG or WebP, up to 15 MB. We resize it for every screen.</p>
      <div className="mt-2">
        <ErrorNote error={upload.error || remove.error} />
      </div>
    </div>
  );
}
