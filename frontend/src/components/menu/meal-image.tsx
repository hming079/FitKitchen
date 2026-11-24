import { useState } from "react";
import { ImageOff } from "lucide-react";
import chickenMealImage from "@/assets/teriyaki-chicken-meal.jpg";
import beefMealImage from "@/assets/grilled-beef-meal.jpg";
import cutComboImage from "@/assets/cut-combo-meal.jpg";
import { cn } from "@/lib/utils";

const localMealImages = new Map([
  ["ức gà nướng măng tây", chickenMealImage],
  ["bò sốt tiêu đen", beefMealImage],
  ["combo 7 ngày giảm cân", cutComboImage],
]);

export function getLocalMealImage(name: string) {
  return localMealImages.get(name.trim().toLocaleLowerCase("vi-VN"));
}

export function MenuMealImage({
  url,
  name,
  fallbackUrl,
  lazy = false,
  thumbnail = false,
  className,
}: {
  url: string | null;
  name: string;
  fallbackUrl?: string;
  lazy?: boolean;
  thumbnail?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = url?.trim();
  const supported = src && (/^https?:\/\//i.test(src) || /^\/(?![/\\])/.test(src));
  const [usingFallback, setUsingFallback] = useState(!supported && Boolean(fallbackUrl));
  const imageSrc = usingFallback ? fallbackUrl : supported ? src : undefined;
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
      {imageSrc && !failed ? (
        <img
          src={imageSrc}
          alt={name}
          loading={lazy ? "lazy" : "eager"}
          onError={(event) => {
            if (fallbackUrl && !usingFallback) {
              setUsingFallback(true);
              return;
            }
            setFailed(true);
          }}
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
