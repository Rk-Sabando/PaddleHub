"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Tiny client-side paginator. Keeps state local, clamps to valid range if the
// underlying items array shrinks (e.g. realtime refresh removes a row).
export function usePagination<T>(items: readonly T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const clamped = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (clamped - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, clamped, pageSize]);

  return {
    page: clamped,
    totalPages,
    pageItems,
    setPage: (p: number) =>
      setPage(Math.max(1, Math.min(p, totalPages))),
    canPrev: clamped > 1,
    canNext: clamped < totalPages,
    total: items.length,
  };
}

type Props = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  canPrev: boolean;
  canNext: boolean;
  setPage: (p: number) => void;
  className?: string;
};

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  canPrev,
  canNext,
  setPage,
  className,
}: Props) {
  if (total <= pageSize) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div
      className={`flex items-center justify-between gap-3 text-sm text-muted-foreground ${className ?? ""}`}
    >
      <span>
        {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canPrev}
          onClick={() => setPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canNext}
          onClick={() => setPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
