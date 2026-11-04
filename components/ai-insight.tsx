import { Sparkles } from "lucide-react";

/**
 * The "AI insight (Experimental)" block beneath a narrated chart. A
 * deterministic template: the narration was generated at snapshot time
 * from the chart's own aggregates and validated against its figures,
 * so it is inserted verbatim and never modified here. No narration,
 * no block. Inside a card the surface recedes into the page
 * background; `outlined` swaps that for a transparent surface with a
 * border, for the blocks that sit on the page background itself.
 */
export function AiInsight({
  text,
  outlined = false,
}: {
  text: string;
  outlined?: boolean;
}) {
  return (
    <div
      className={
        outlined
          ? "mt-4 flex flex-col gap-2 rounded-xl border border-border p-4"
          : "mt-4 flex flex-col gap-2 rounded-xl bg-background p-4"
      }
    >
      <p className="flex flex-wrap items-center gap-1.5 text-lg font-bold tracking-tight text-primary">
        <Sparkles aria-hidden="true" className="size-5 shrink-0" />
        AI insight
        <span className="rounded-full bg-brand-accent/10 px-2 py-0.5 text-sm font-semibold tracking-wide text-brand-accent uppercase">
          Experimental
        </span>
      </p>
      <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
        {text}
      </p>
    </div>
  );
}
