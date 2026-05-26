import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireRole, ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";

const patchSchema = z.object({
    matchmakingDisabled: z.boolean(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireRole(Role.ADMIN);
        const { id } = await params;
        const body = await req.json();
        const parsed = patchSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid input", issues: parsed.error.flatten() },
                { status: 400 },
            );
        }
        const event = await db.event.update({
            where: { id },
            data: { matchmakingDisabled: parsed.data.matchmakingDisabled },
        });
        return NextResponse.json({ event });
    } catch (err) {
        if (err instanceof UnauthorizedError) {
            return NextResponse.json({ error: err.message }, { status: 401 });
        }
        if (err instanceof ForbiddenError) {
            return NextResponse.json({ error: err.message }, { status: 403 });
        }
        console.error("[events.matchmaking-disabled.patch] failed", err);
        return NextResponse.json({ error: "Could not update matchmakingDisabled" }, { status: 500 });
    }
}