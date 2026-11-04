import Image, { type StaticImageData } from "next/image";

import before from "@/public/images/cleaning-before.webp";
import hero from "@/public/images/hero.jpg";
import deep from "@/public/images/services/deep.jpg";
import facility from "@/public/images/services/facility.jpg";
import move from "@/public/images/services/move.jpg";
import postConstruction from "@/public/images/services/post-construction.jpg";
import standard from "@/public/images/services/standard.jpg";
import interiorDecor from "@/public/images/use-cases/interior-decor.jpg";
import offices from "@/public/images/use-cases/offices.jpg";
import realEstate from "@/public/images/use-cases/real-estate.jpg";
import shortlets from "@/public/images/use-cases/shortlets.jpg";

// Keep the API's existing paths while serving content-hashed assets, so a photo
// replacement invalidates both browser and Next.js image-optimisation caches.
const bundledPhotos: Record<string, StaticImageData> = {
  "/images/cleaning-before.webp": before,
  "/images/hero.jpg": hero,
  "/images/services/deep.jpg": deep,
  "/images/services/facility.jpg": facility,
  "/images/services/move.jpg": move,
  "/images/services/post-construction.jpg": postConstruction,
  "/images/services/standard.jpg": standard,
  "/images/use-cases/interior-decor.jpg": interiorDecor,
  "/images/use-cases/offices.jpg": offices,
  "/images/use-cases/real-estate.jpg": realEstate,
  "/images/use-cases/shortlets.jpg": shortlets,
};

/**
 * A cover photo that fills its (relatively positioned) parent.
 *
 * Starter photos in /public go through Next.js image optimisation. Photos
 * uploaded in the admin (/media/…) are already resized to WebP by the backend
 * (large + card versions) and are served by Caddy, so they're used directly
 * with a srcset; Next.js can't fetch them from inside its container.
 */
export function Photo({
  src,
  card,
  alt,
  sizes,
  priority = false,
  className = "",
}: {
  src: string;
  card?: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const classes = `absolute inset-0 size-full object-cover ${className}`;
  if (src.startsWith("/media/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        srcSet={card && card !== src ? `${card} 960w, ${src} 2000w` : undefined}
        sizes={sizes}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        className={classes}
      />
    );
  }
  return <Image src={bundledPhotos[src] ?? src} alt={alt} fill priority={priority} quality={90} sizes={sizes} className={classes} />;
}
