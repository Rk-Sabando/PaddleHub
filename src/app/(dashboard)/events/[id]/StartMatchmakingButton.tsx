"use client";

import { useRouter } from "next/navigation";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useStartMatchmaking } from "@/hooks/useEvents";

type Props = {
  eventId: string;
};

export function StartMatchmakingButton({ eventId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const start = useStartMatchmaking(eventId);

  const run = () =>
    start.mutate(undefined, {
      onSuccess: (data) => {
        const parts: string[] = [`${data.created} match(es) created`];
        if (data.leftover.length > 0) {
          parts.push(
            `${data.leftover.length} unpaired: ${data.leftover
              .map((l) => l.name)
              .join(", ")}`,
          );
        }
        toast({
          title: "Matchmaking complete",
          description: parts.join(" · "),
        });
        router.refresh();
      },
    });

  return (
    <Button type="button" size="sm" disabled={start.isPending} onClick={run}>
      <Shuffle className="mr-1 h-4 w-4" />
      {start.isPending ? "Pairing players…" : "Start matchmaking"}
    </Button>
  );
}
