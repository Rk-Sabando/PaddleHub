import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { eventService } from "@/server/services/eventService";
import { AdminEventsView } from "./AdminEventsView";
import { PlayerEventsView } from "./PlayerEventsView";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const user = await requireAuth();

  if (user.role === Role.ADMIN) {
    const events = await eventService.listForAdmin();
    return <AdminEventsView events={events} />;
  }

  const [current, browseable] = await Promise.all([
    eventService.getCurrentForPlayer(user.id),
    eventService.listForPlayer(user.id),
  ]);
  return <PlayerEventsView current={current} browseable={browseable} />;
}
