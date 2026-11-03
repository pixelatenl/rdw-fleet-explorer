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
    <div className="mt-4 flex flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
        <Sparkles aria-hidden="true" className="size-4 shrink-0" />
        AI insight
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Experimental
        </span>
      </p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
