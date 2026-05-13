import Image from "next/image";

// TODO: Circular avatar with fallback initials.
export function PlayerAvatar({ name, src }: { name: string; src?: string | null }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
      {src ? <Image src={src} alt={name} className="h-full w-full rounded-full object-cover" /> : name.charAt(0)}
    </div>
  );
}
