export type ClassValue = string | false | null | undefined;

/** Minimal class combiner, dependency-free stand-in for cn(). */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
