import { Sparkles } from "lucide-react";

/**
 * The "AI insight (Experimental)" block beneath a narrated chart. A
 * deterministic template: the narration was generated at snapshot time
 * from the chart's own aggregates and validated against its figures,
 * so it is inserted verbatim and never modified here. No narration,
 * no block.
 */
export function AiInsight({ text }: { text: string }) {
  return (
    <div className="mt-4 flex flex-col gap-2 rounded-xl bg-background p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
        <Sparkles aria-hidden="true" className="size-4 shrink-0" />
        AI insight
        <span className="rounded-full bg-brand-accent/10 px-2 py-0.5 text-xs font-semibold tracking-wide text-brand-accent uppercase">
          Experimental
        </span>
      </p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
