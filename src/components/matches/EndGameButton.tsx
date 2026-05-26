"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEndAndAdvanceMatch } from "@/hooks/useMatches";

type Props = {
  matchId: string;
  // Override the trigger button label. Default: "End game".
  label?: string;
  // Override the dialog copy for player vs admin contexts.
  title?: string;
  description?: React.ReactNode;
  // Forward styling to the trigger button.
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
};

// Shared end-match action with confirmation dialog. Used by both the admin
// courts board and the player "Now playing" card so an accidental tap can't
// drop a match in flight.
export function EndGameButton({
  matchId,
  label = "End game",
  title = "End this match?",
  description = "This marks the current match completed and frees the court for the next group. This can't be undone.",
  size = "sm",
  variant = "outline",
  className,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const end = useEndAndAdvanceMatch();
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    end.mutate(matchId, {
      onSuccess: (data) => {
        toast({
          title: "Match ended",
          description: data.nextMatchId
            ? `Next up: ${data.nextParticipants.map((p) => p.name).join(", ")}`
            : "No more players available — court is now idle.",
        });
        setOpen(false);
        router.refresh();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !end.isPending && setOpen(next)}>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={end.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={end.isPending}
          >
            {end.isPending ? "Ending…" : "End match"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
