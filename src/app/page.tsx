import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-6 py-16 text-center">
      <h1 className="text-5xl font-bold tracking-tight">PaddleHub</h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Find your next pickleball match by skill, schedule, and format. Real-time updates, smart
        match-making, and zero scheduling friction.
      </p>
      <div className="flex gap-4">
        <Link
          href={{ pathname: "/sign-up" }}
          className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
        >
          Get started
        </Link>
        <Link href={{ pathname: "/sign-in" }} className="rounded-md border px-6 py-3 font-medium">
          Sign in
        </Link>
      </div>
    </main>
  );
}
