"use client";
// TODO: Optimistic join — TanStack Query mutation, toast on success/error.
import { Button } from "@/components/ui/button";

export function JoinButton({ matchId }: { matchId: string }) {
  return <Button onClick={() => console.log("join", matchId)}>Join</Button>;
}
