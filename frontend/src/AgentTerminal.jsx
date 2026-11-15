import { useEffect, useRef } from "react";
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const TONE_CLASS = {
  cyan: "text-primary",
  ok: "text-not-affected",
  warn: "text-likely",
  bad: "text-affected",
  muted: "text-muted-foreground",
};

const AGENT_BADGE = {
  cyan: "border-primary/40 bg-primary/10 text-primary",
  emerald: "border-not-affected/40 bg-not-affected/10 text-not-affected",
  rose: "border-affected/40 bg-affected/10 text-affected",
  warn: "border-likely/50 bg-likely/15 text-likely",
  ok: "border-not-affected/35 bg-not-affected/10 text-not-affected",
  muted: "border-border bg-muted/40 text-muted-foreground",
};

export default function AgentTerminal({ lines, working, cveId }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lines.length, working]);

  return (
    <Card className="flex min-w-0 flex-col gap-0 overflow-hidden border-border/90 bg-[#05080f] py-0 shadow-lg lg:sticky lg:top-20">
      <div className="flex items-center justify-between gap-2 border-b border-border/80 bg-card/90 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Activity aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
          <span className="truncate font-mono text-xs font-semibold tracking-wider uppercase text-foreground">
            Live Agent Activity
          </span>
          {cveId && (
            <span className="hidden truncate font-mono text-[11px] text-muted-foreground sm:inline">
              · {cveId}
            </span>
          )}
        </div>
        {working ? (
          <Badge variant="outline" className="shrink-0 border-primary/40 text-primary">
            <Spinner aria-hidden="true" />
            Running
          </Badge>
        ) : (
          <Badge variant="secondary" className="shrink-0">Idle</Badge>
        )}
      </div>

      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Live agent commands"
        className="h-[420px] overflow-y-auto p-3.5 font-mono text-xs leading-relaxed lg:h-[640px]"
      >
        {lines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center text-muted-foreground">
            <p>Waiting for agent activity…</p>
            <p className="text-[11px] text-muted-foreground/75">
              Plain-English updates from Agent 1, Agent 2, and Agent 3 appear here live.
            </p>
          </div>
        ) : (
          <ol className="grid gap-3">
            {lines.map((line, idx) => {
              const prevAgent = idx > 0 ? lines[idx - 1].agent?.label : null;
              const showAgentHeader = line.agent && line.agent.label !== prevAgent;
              return (
                <li key={line.id} className="animate-in fade-in grid gap-1 duration-300">
                  {showAgentHeader && (
                    <div className="pt-1">
                      <span
                        className={`inline-block rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
                          AGENT_BADGE[line.agent.tone] || AGENT_BADGE.muted
                        }`}
                      >
                        {line.agent.label}
                      </span>
                    </div>
                  )}
                  {line.comment && (
                    <div className="text-[11px] text-muted-foreground/80">
                      # {line.comment}
                    </div>
                  )}
                  <div className="flex items-start gap-2 break-words">
                    <span aria-hidden="true" className={`select-none font-semibold ${TONE_CLASS[line.tone] || "text-primary"}`}>
                      {line.prompt}
                    </span>
                    <span className={`min-w-0 flex-1 break-words ${line.tone === "muted" ? "text-muted-foreground" : "text-foreground"}`}>
                      {line.cmd}
                      {line.active && (
                        <span
                          aria-hidden="true"
                          className="ml-1.5 inline-block h-3.5 w-2 translate-y-0.5 animate-pulse bg-primary"
                        />
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Card>
  );
}
