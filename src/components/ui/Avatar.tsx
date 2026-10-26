import Image from "next/image";

type AvatarSize = "sm" | "md" | "lg";

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

/** Shared staff avatar with a brand-consistent initials fallback. */
export function Avatar({ name, src, size = "md", className = "" }: { name: string; src?: string | null; size?: AvatarSize; className?: string }) {
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-500/10 font-bold text-brand-500 ${sizeClasses[size]} ${className}`}>
      {src ? <Image src={src} alt={name} fill sizes={size === "sm" ? "32px" : size === "md" ? "40px" : "48px"} className="object-cover" /> : initials(name)}
    </span>
  );
}
