import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { eventService } from "@/server/services/eventService";
import { AdminEventDetail } from "./AdminEventDetail";
import { PlayerEventDetail } from "./PlayerEventDetail";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const event = await eventService.getById(id);
  if (!event) notFound();

  if (user.role === Role.ADMIN) {
    return <AdminEventDetail event={event} />;
  }

  return <PlayerEventDetail event={event} viewerId={user.id} />;
}
