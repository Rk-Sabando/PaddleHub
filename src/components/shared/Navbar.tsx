import { UserButton } from "@clerk/nextjs";

export function Navbar() {
  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <span className="font-semibold">PaddleHub</span>
      <UserButton afterSignOutUrl="/" />
    </header>
  );
}
