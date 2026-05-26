import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import {
  Bell,
  Calendar,
  ChevronRight,
  ListOrdered,
  Pause,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

export default async function LandingPage() {
  const { userId } = await auth();
  const signedIn = !!userId;

  return (
    <main className="min-h-screen bg-background">
      <Hero signedIn={signedIn} />
      <HowItWorks />
      <Features />
      <ClosingCta signedIn={signedIn} />
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        <p>PaddleHub · Find your next pickleball match.</p>
      </footer>
    </main>
  );
}

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="container relative isolate flex flex-col items-center gap-6 px-6 py-16 text-center sm:py-24">
      <div className="flex items-center gap-3">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={48}
          height={48}
          className="rounded-lg"
          priority
        />
        <span className="text-2xl font-semibold tracking-tight">PaddleHub</span>
      </div>

      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
        Show up. Get matched. <span className="text-primary">Play more pickleball.</span>
      </h1>

      <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
        Skill-balanced matchmaking for casual and competitive players. Join an event and
        we&apos;ll pair you up automatically — no waiting around, no awkward "who&apos;s next?"
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        {signedIn ? (
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
          >
            Continue to dashboard
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <>
            <Link
              href={{ pathname: "/sign-up" }}
              className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
            >
              Create your player profile
            </Link>
            <Link
              href={{ pathname: "/sign-in" }}
              className="rounded-md border px-6 py-3 font-medium hover:bg-accent"
            >
              Sign in
            </Link>
          </>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Skill-balanced pairing
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 text-primary" /> Background push notifications
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ListOrdered className="h-3.5 w-3.5 text-primary" /> Live queue position
        </span>
      </div>
    </section>
  );
}

const steps = [
  {
    icon: Calendar,
    title: "Find an event",
    body: "Browse upcoming events open for signup. Filter by format and skill level — singles or doubles, beginner to pro.",
  },
  {
    icon: Users,
    title: "Request to join",
    body: "Organizers confirm you on the roster. You'll get a notification the moment you're in.",
  },
  {
    icon: Trophy,
    title: "Play matches",
    body: "Auto-paired with players within 1.0 of your skill rating. We tell you exactly which court to head to.",
  },
];

function HowItWorks() {
  return (
    <section className="border-t bg-muted/30 py-16 sm:py-20">
      <div className="container px-6">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Three taps from "I want to play" to standing on a court.
          </p>
        </div>
        <ol className="grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-lg border bg-card p-6">
              <span className="absolute -top-3 left-6 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <s.icon className="mb-3 h-6 w-6 text-primary" />
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const features = [
  {
    icon: Sparkles,
    title: "Skill-balanced matchmaking",
    body: "We pair groups whose highest and lowest player are within 1.0 of each other — close games, no blowouts.",
  },
  {
    icon: ListOrdered,
    title: "See your queue position",
    body: "Know exactly how many matches are in front of yours so you can grab water or warm up at the right time.",
  },
  {
    icon: Bell,
    title: "Background push notifications",
    body: "We ping you the second your court is ready — even if the app is closed. Install as a PWA on your phone.",
  },
  {
    icon: Pause,
    title: "Sit out anytime",
    body: "Need a break mid-event? Pause matchmaking without leaving the event. Resume when you're ready.",
  },
  {
    icon: Users,
    title: "Fair rotation",
    body: "Players who've waited longest get priority. No one sits on the sidelines while the same group keeps playing.",
  },
  {
    icon: Trophy,
    title: "End your own match",
    body: "Group finished? Tap End game. The next queued match takes the court — no waiting on an organizer.",
  },
];

function Features() {
  return (
    <section className="py-16 sm:py-20">
      <div className="container px-6">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Built for players</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Every feature points at one thing — getting you on a court, faster.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-6">
              <f.icon className="mb-3 h-5 w-5 text-primary" />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="border-t bg-muted/30 py-16 sm:py-20">
      <div className="container flex flex-col items-center gap-4 px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Ready to paddle up?</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Set up your player profile in under a minute. We&apos;ll start pairing you with players
          at your level on your next event.
        </p>
        {signedIn ? (
          <Link
            href="/dashboard"
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
          >
            Open your dashboard
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            href={{ pathname: "/sign-up" }}
            className="mt-2 rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
          >
            Create your player profile
          </Link>
        )}
      </div>
    </section>
  );
}
