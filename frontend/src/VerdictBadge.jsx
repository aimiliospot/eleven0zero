import { Badge } from "@/components/ui/badge";
import { VERDICTS, verdictOf } from "./verdicts.js";

export default function VerdictBadge({ verdict }) {
  const key = verdictOf(verdict);
  return (
    <Badge variant={key}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {VERDICTS[key].label}
    </Badge>
  );
}
