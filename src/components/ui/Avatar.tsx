import Image from "next/image";

type AvatarSize = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-24 w-24 text-2xl",
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

/** Shared staff avatar with a brand-consistent initials fallback. */
export function Avatar({ name, src, size = "md", shape = "rounded", className = "" }: { name: string; src?: string | null; size?: AvatarSize; shape?: "rounded" | "circle"; className?: string }) {
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden ${shape === "circle" ? "rounded-full" : "rounded-xl"} bg-brand-500/10 font-bold text-brand-500 ${sizeClasses[size]} ${className}`}>
      {src ? <Image src={src} alt={name} fill sizes={size === "sm" ? "32px" : size === "md" ? "40px" : size === "lg" ? "48px" : "96px"} className="object-cover" /> : initials(name)}
    </span>
  );
}
