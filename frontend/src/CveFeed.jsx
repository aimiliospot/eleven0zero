import CveLink from "./CveLink.jsx";
import { isPending } from "./pendingRows.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const STATUS_VARIANT = { evaluated: "not_affected", failed: "affected" };

export default function CveFeed({ cves, onAnalyze }) {
  return (
    <section className="grid min-w-0 gap-3">
      <div className="flex items-center gap-2">
        <h2 className="font-mono text-xs font-semibold tracking-wider uppercase text-muted-foreground">Latest CVEs</h2>
        {cves.length > 0 && <span className="font-mono text-xs tabular-nums text-muted-foreground">{cves.length}</span>}
      </div>
      {cves.length ? (
        <Card className="min-w-0 gap-0 overflow-hidden px-3.5 py-1">
          <ul className="divide-y divide-border/70">
            {cves.map((c) => (
              <li key={c.id} className="flex min-w-0 items-center gap-2.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <CveLink id={c.id} />
                    {c.cvss != null && (
                      <Badge variant={c.cvss >= 9.0 ? "affected" : c.cvss >= 7.0 ? "likely" : "secondary"}>
                        CVSS {c.cvss}
                      </Badge>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground" title={c.title}>{c.title}</div>
                  {c.status === "skipped" && <div className="font-mono text-[11px] text-muted-foreground">No VM inventory yet</div>}
                </div>
                {isPending(c)
                  ? <Spinner aria-label={`Evaluating ${c.id}`} className="shrink-0 text-primary" />
                  : <Badge variant={STATUS_VARIANT[c.status] || "secondary"}>{c.status}</Badge>}
                <Button
                  variant="outline"
                  size="xs"
                  className="shrink-0 font-mono uppercase tracking-wider"
                  aria-label={`Analyze ${c.id}`}
                  disabled={isPending(c)}
                  onClick={() => onAnalyze(c.id)}
                >
                  Analyze
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-card/50 p-5 text-center text-sm text-muted-foreground">
          Waiting for the feed…
        </p>
      )}
    </section>
  );
}
