import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Profile photo.
 *
 * A plain <img>, not next/image, on purpose: the two renditions are already
 * resized and WebP-encoded at upload time (lib/services/upload.ts), so running
 * them through Vercel's optimiser would add a per-image cost for no benefit.
 * They are served straight from Supabase's CDN with a long cache.
 */
export function ProfilePhoto({ src, name, className, size = "card", priority }: {
  src: string | null;
  name: string;
  className?: string;
  size?: "card" | "detail" | "avatar";
  priority?: boolean;
}) {
  const shape =
    size === "avatar" ? "aspect-square rounded-full"
    : size === "detail" ? "aspect-square rounded-card"
    : "aspect-3/4 rounded-t-card";

  if (!src) {
    return (
      <div
        className={cn("grid place-items-center bg-primary-soft text-primary-border", shape, className)}
        role="img"
        aria-label={`${name} has no photo`}
      >
        <UserRound className="h-1/4 w-1/4" aria-hidden />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={cn("h-full w-full object-cover bg-primary-soft", shape, className)}
    />
  );
}
