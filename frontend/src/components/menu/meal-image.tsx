import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function MenuMealImage({
  url,
  name,
  lazy = false,
  className,
}: {
  url: string | null;
  name: string;
  lazy?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = url?.trim();
  const supported = src && (/^https?:\/\//i.test(src) || /^\/(?![/\\])/.test(src));
  return (
    <div className={cn("overflow-hidden bg-secondary", className)}>
      {supported && !failed ? (
        <img
          src={src}
          alt={name}
          loading={lazy ? "lazy" : "eager"}
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <div className="grid min-h-24 place-content-center justify-items-center gap-2 text-secondary-foreground sm:aspect-[4/3]">
          <ImageOff className="size-5" aria-hidden />
          <span className="text-sm">Photo unavailable</span>
        </div>
      )}
    </div>
  );
}
