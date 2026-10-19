import Image from "next/image";

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
  return <Image src={src} alt={alt} fill priority={priority} quality={90} sizes={sizes} className={classes} />;
}
