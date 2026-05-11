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

  console.log(`Seeded 1 admin, ${players.length} players, ${courts.length} courts, 2 matches.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
