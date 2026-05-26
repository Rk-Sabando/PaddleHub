import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher-server";

// Authenticates clients for Pusher private/presence channels (chat per match).
export async function POST(req: Request) {
  const user = await requireAuth();
  const data = await req.formData();
  const socketId = String(data.get("socket_id"));
  const channel = String(data.get("channel_name"));

  if (channel.startsWith("private-user-") && channel !== `private-user-${user.id}`) {
    return NextResponse.json({ error: "Forbidden channel" }, { status: 403 });
  }

  const authResponse = pusherServer.authorizeChannel(socketId, channel, {
    user_id: user.id,
    user_info: { name: user.name, avatarUrl: user.avatarUrl ?? null },
  });
  return NextResponse.json(authResponse);
}
