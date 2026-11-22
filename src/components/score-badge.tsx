import { Badge } from "@/components/ui";
import { QUALIFIED_THRESHOLD } from "@/domain/rules/scoring";

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Badge>Not scored</Badge>;
  const tone = score >= QUALIFIED_THRESHOLD ? "green" : score >= 40 ? "amber" : "red";
  const label = score >= QUALIFIED_THRESHOLD ? "Good fit" : score >= 40 ? "Maybe" : "Poor fit";
  return (
    <Badge tone={tone} className="gap-1 tabular-nums">
      <span className="font-semibold">{score}</span> · {label}
    </Badge>
  );
}
