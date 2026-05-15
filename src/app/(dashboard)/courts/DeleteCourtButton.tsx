"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Court } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useDeleteCourt } from "@/hooks/useCourts";

type Props = {
  court: Court & { _count: { matches: number } };
};

export function DeleteCourtButton({ court }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const remove = useDeleteCourt();

  const blocked = court._count.matches > 0;

  const confirm = () => {
    remove.mutate(court.id, {
      onSuccess: () => {
        toast({ title: `Deleted ${court.name}` });
        setOpen(false);
        router.refresh();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="mr-1 h-3.5 w-3.5" />
        Delete
      </Button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {court.name}?</DialogTitle>
          <DialogDescription>
            {blocked
              ? `This court is referenced by ${court._count.matches} match(es). Set its status to CLOSED instead — deleting it would break match history.`
              : "This is permanent. Anyone who later tries to schedule on this court will need to pick a different one."}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={remove.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={confirm}
            disabled={remove.isPending || blocked}
          >
            {remove.isPending ? "Deleting…" : "Delete court"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
