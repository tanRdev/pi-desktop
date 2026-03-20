import type * as React from "react";
import { cn } from "@/lib/utils";

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  aspect?: "square" | "landscape" | "auto";
}

export function Image({
  aspect = "auto",
  className,
  alt = "",
  ...props
}: ImageProps) {
  return (
    <div
      className={cn(
        "overflow-hidden border border-[#474747]/25 bg-[#111111]",
        aspect === "square" && "aspect-square",
        aspect === "landscape" && "aspect-[16/10]",
      )}
    >
      <img
        alt={alt}
        className={cn("h-full w-full object-cover", className)}
        {...props}
      />
    </div>
  );
}
