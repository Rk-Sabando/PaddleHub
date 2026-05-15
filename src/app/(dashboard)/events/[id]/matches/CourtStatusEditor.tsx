"use client";

import { useRouter } from "next/navigation";
import { CourtStatus } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUpdateCourt } from "@/hooks/useCourts";

const OPTIONS: { value: CourtStatus; label: string }[] = [
  { value: CourtStatus.AVAILABLE, label: "Available" },
  { value: CourtStatus.MAINTENANCE, label: "Maintenance" },
  { value: CourtStatus.RENTED, label: "Rented" },
  { value: CourtStatus.CLOSED, label: "Closed" },
];

type Props = {
  courtId: string;
  status: CourtStatus;
};

export function CourtStatusEditor({ courtId, status }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const update = useUpdateCourt();

  const onChange = (next: string) => {
    const value = next as CourtStatus;
    if (value === status) return;
    update.mutate(
      { id: courtId, input: { status: value } },
      {
        onSuccess: () => {
          toast({ title: "Court status updated", description: value });
          router.refresh();
        },
      },
    );
  };

  return (
    <Select value={status} onValueChange={onChange} disabled={update.isPending}>
      <SelectTrigger className="h-8 w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
