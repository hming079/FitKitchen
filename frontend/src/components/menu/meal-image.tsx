import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function MenuMealImage({
  url,
  name,
  lazy = false,
  thumbnail = false,
  className,
}: {
  url: string | null;
  name: string;
  lazy?: boolean;
  thumbnail?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = url?.trim();
  const supported = src && (/^https?:\/\//i.test(src) || /^\/(?![/\\])/.test(src));
  return (
    <div
      className={cn(
        "overflow-hidden",
        thumbnail
          ? "grid size-11 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"
          : "bg-secondary",
        className,
      )}
    >
      {supported && !failed ? (
        <img
          src={src}
          alt={name}
          loading={lazy ? "lazy" : "eager"}
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          className={cn("object-cover", thumbnail ? "size-full" : "aspect-[4/3] w-full")}
        />
      ) : thumbnail ? (
        <ImageOff className="size-4" aria-hidden />
      ) : (
        <div className="grid min-h-24 place-content-center justify-items-center gap-2 text-secondary-foreground sm:aspect-[4/3]">
          <ImageOff className="size-5" aria-hidden />
          <span className="text-sm">Photo unavailable</span>
        </div>
      )}
    </div>
  );
}
