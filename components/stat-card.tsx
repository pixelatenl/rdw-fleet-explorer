import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}

export function StatCard({ label, value, sub, className }: StatCardProps) {
  return (
    <Card className={cn("gap-2 py-4", className)}>
      <CardHeader className="px-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <CardTitle className="text-2xl tabular-nums sm:text-3xl">
          {value}
        </CardTitle>
      </CardHeader>
      {sub ? (
        <CardContent className="text-sm text-muted-foreground">
          {sub}
        </CardContent>
      ) : null}
    </Card>
  );
}
