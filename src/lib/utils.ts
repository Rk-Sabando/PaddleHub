import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRange(min: number, max: number) {
  return `${min.toFixed(1)}–${max.toFixed(1)}`;
}
