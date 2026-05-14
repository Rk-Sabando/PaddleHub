import {
  PrismaClient,
  MatchFormat,
  MatchStatus,
  SkillLevel,
  Role,
  CourtStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.paddlehub.app" },
    update: { role: Role.ADMIN },
    create: {
      clerkId: "demo_admin",
      email: "admin@demo.paddlehub.app",
      name: "Olivia Admin",
      role: Role.ADMIN,
      skillRating: 4.5,
      skillLevel: SkillLevel.ADVANCED,
      preferredFormat: MatchFormat.DOUBLES,
    },
  });

  const players = await Promise.all(
    [
      { email: "alice@demo.paddlehub.app", clerkId: "demo_alice", name: "Alice Chen", rating: 3.5 },
      { email: "bob@demo.paddlehub.app", clerkId: "demo_bob", name: "Bob Singh", rating: 3.7 },
      { email: "carla@demo.paddlehub.app", clerkId: "demo_carla", name: "Carla Diaz", rating: 4.1 },
      { email: "dan@demo.paddlehub.app", clerkId: "demo_dan", name: "Dan Park", rating: 2.8 },
    ].map((p) =>
      prisma.user.upsert({
        where: { email: p.email },
        update: { role: "PLAYER" },
        create: {
          clerkId: p.clerkId,
          email: p.email,
          name: p.name,
          role: "PLAYER",
          skillRating: p.rating,
          skillLevel: SkillLevel.INTERMEDIATE,
          preferredFormat: MatchFormat.DOUBLES,
        },
      }),
    ),
  );

  const byEmail = Object.fromEntries(players.map((p) => [p.email, p]));
  const alice = byEmail["alice@demo.paddlehub.app"]!;
  const bob = byEmail["bob@demo.paddlehub.app"]!;
  const carla = byEmail["carla@demo.paddlehub.app"]!;

  const courts = await Promise.all(
    [
      { name: "Court A", location: "North Pavilion", surface: "Hardcourt" },
      { name: "Court B", location: "North Pavilion", surface: "Hardcourt" },
      { name: "Court C", location: "South Pavilion", surface: "Clay" },
    ].map((c) =>
      prisma.court.upsert({
        where: { name: c.name },
        update: { managerId: admin.id },
        create: {
          name: c.name,
          location: c.location,
          surface: c.surface,
          status: CourtStatus.AVAILABLE,
          managerId: admin.id,
        },
      }),
    ),
  );
  const courtA = courts[0]!;
  const courtB = courts[1]!;

  await prisma.match.create({
    data: {
      hostId: alice.id,
      courtId: courtA.id,
      scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      format: MatchFormat.DOUBLES,
      skillMin: 3.0,
      skillMax: 4.0,
      capacity: 4,
      status: MatchStatus.OPEN,
      notes: "Casual evening doubles. Bring water!",
      participants: { create: [{ userId: alice.id }, { userId: bob.id }] },
    },
  });

  await prisma.match.create({
    data: {
      hostId: carla.id,
      courtId: courtB.id,
      scheduledAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      format: MatchFormat.DOUBLES,
      skillMin: 3.0,
      skillMax: 4.5,
      capacity: 4,
      status: MatchStatus.COMPLETED,
      notes: "Completed match for history demo.",
      participants: { create: [{ userId: carla.id }, { userId: alice.id }, { userId: bob.id }] },
    },
  });

  const randomPlayers = await seedRandomPlayers(40);

  console.log(
    `Seeded 1 admin, ${players.length + randomPlayers.length} players (${randomPlayers.length} random), ${courts.length} courts, 2 matches.`,
  );
}

const FIRST_NAMES = [
  "Aaron", "Bea", "Cleo", "Devon", "Emi", "Felix", "Gina", "Hugo",
  "Iris", "Jade", "Kai", "Lara", "Milo", "Nico", "Omar", "Priya",
  "Quinn", "Rosa", "Sasha", "Theo", "Uma", "Vince", "Wren", "Xander",
  "Yui", "Zane", "Ada", "Bram", "Cora", "Dante", "Esme", "Finn",
  "Gabi", "Hana", "Ines", "Jonas", "Kira", "Leo", "Maya", "Nora",
];

const LAST_NAMES = [
  "Adler", "Bao", "Cruz", "Dela Rosa", "Eberhardt", "Foster", "Garcia",
  "Hong", "Ito", "Joshi", "Khan", "Lim", "Mendoza", "Nguyen", "Okafor",
  "Park", "Quintero", "Reyes", "Santos", "Tanaka", "Uddin", "Voss",
  "Wang", "Xu", "Yamada", "Zaldivar", "Ali", "Becker", "Cohen", "Davila",
  "Eriksen", "Flores", "Gonzales", "Hartono", "Ivanov", "Jacobs",
];

const BIOS = [
  null,
  "Weekend warrior; love a good doubles rally.",
  "Picked up the paddle last summer and now I can't put it down.",
  "Ex-tennis player, slowly converting to pickleball.",
  "Looking for friendly games. Skill above ego.",
  "Strong third shot drop, working on the dink game.",
  null,
  "Coach by day, player by evening.",
];

const SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "PRO"] as const;
const FORMATS = ["DOUBLES", "SINGLES"] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pickWeighted<T>(weights: ReadonlyArray<[T, number]>): T {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [value, weight] of weights) {
    if ((roll -= weight) <= 0) return value;
  }
  return weights[weights.length - 1]![0];
}

async function seedRandomPlayers(count: number) {
  const ops = Array.from({ length: count }, (_, i) => {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const lastName = LAST_NAMES[(i * 7) % LAST_NAMES.length]!;
    const name = `${firstName} ${lastName}`;
    const email = `seed-${i + 1}@demo.paddlehub.app`;
    const clerkId = `demo_seed_${i + 1}`;
    // Deterministic-ish: clamp to one decimal, between 2.0 and 4.9.
    const skillRating = Math.round((2 + Math.random() * 2.9) * 10) / 10;
    const skillLevel = pickWeighted<(typeof SKILL_LEVELS)[number]>([
      ["BEGINNER", 2],
      ["INTERMEDIATE", 5],
      ["ADVANCED", 2],
      ["PRO", 1],
    ]);
    const preferredFormat = pickWeighted<(typeof FORMATS)[number]>([
      ["DOUBLES", 7],
      ["SINGLES", 3],
    ]);
    // Spread joins over the last ~90 days; mark onboarded so they don't get
    // shunted into the onboarding flow if someone signs in as them.
    const createdAt = new Date(
      Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000,
    );
    const onboardedAt = new Date(createdAt.getTime() + 5 * 60 * 1000);

    return prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        clerkId,
        email,
        name,
        role: Role.PLAYER,
        skillLevel: skillLevel as SkillLevel,
        skillRating,
        preferredFormat: preferredFormat as MatchFormat,
        bio: pick(BIOS),
        onboardedAt,
        createdAt,
      },
    });
  });
  return Promise.all(ops);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
