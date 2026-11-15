import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Play, Square } from "lucide-react";
import AgentTerminal from "./AgentTerminal.jsx";
import FindingDetails from "./FindingDetails.jsx";
import GraphicsStage from "./GraphicsStage.jsx";
import { deriveScene } from "./graphicsState.js";
import { useEvents } from "./useEvents.js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function cveTone(cve, findings) {
  if (cve.status === "new" || cve.status === "evaluating") return "active";
  const list = findings.filter((f) => f.cve_id === cve.id);
  const busy = list.some((f) =>
    ["queued", "running"].includes(f.remediation?.status) || f.exploit?.status === "running"
  );
  if (busy) return "active";
  if (list.some((f) => f.remediation?.status === "auto_shutdown")) return "likely";
  if (list.some((f) => f.verdict === "affected")) return "affected";
  if (list.some((f) => f.verdict === "likely")) return "likely";
  if (list.length > 0) return "safe";
  return "idle";
}

const DOT_CLASS = {
  active: "bg-primary animate-pulse",
  affected: "bg-affected",
  likely: "bg-likely",
  safe: "bg-not-affected",
  idle: "bg-muted-foreground/50",
};

export default function Graphics({ data, onAnalyze }) {
  const rawEvents = useEvents();
  const [cveInput, setCveInput] = useState("");
  const [selectedCve, setSelectedCve] = useState(null);
  const [replayIndex, setReplayIndex] = useState(null);
  const [sandboxHost, setSandboxHost] = useState(null);
  const [inspected, setInspected] = useState(null);
  const seenLatestRef = useRef(null);

  const cveList = useMemo(() => {
    const map = new Map();
    for (const c of data.cves) map.set(c.id, c);
    for (let i = rawEvents.length - 1; i >= 0; i--) {
      const id = rawEvents[i].cve_id;
      if (id && !map.has(id)) map.set(id, { id, title: "", status: "evaluating" });
    }
    return [...map.values()];
  }, [data.cves, rawEvents]);

  const newestEventCve = useMemo(() => {
    for (let i = rawEvents.length - 1; i >= 0; i--) {
      if (rawEvents[i].cve_id) return rawEvents[i].cve_id;
    }
    return cveList[0]?.id || null;
  }, [rawEvents, cveList]);

  useEffect(() => {
    if (!newestEventCve) return;
    if (seenLatestRef.current !== newestEventCve) {
      seenLatestRef.current = newestEventCve;
      if (replayIndex === null) setSelectedCve(newestEventCve);
    } else if (!selectedCve) {
      setSelectedCve(newestEventCve);
    }
  }, [newestEventCve, selectedCve, replayIndex]);

  const activeCveId = selectedCve || newestEventCve;

  const scene = useMemo(
    () => deriveScene({ cveId: activeCveId, data, rawEvents, replayIndex, sandboxHost }),
    [activeCveId, data, rawEvents, replayIndex, sandboxHost]
  );

  useEffect(() => {
    if (replayIndex === null) return;
    if (replayIndex >= scene.fullTimelineLength - 1) {
      const doneTimer = setTimeout(() => setReplayIndex(null), 1600);
      return () => clearTimeout(doneTimer);
    }
    const stepTimer = setTimeout(() => setReplayIndex((i) => (i !== null ? i + 1 : null)), 950);
    return () => clearTimeout(stepTimer);
  }, [replayIndex, scene.fullTimelineLength]);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    const id = cveInput.trim().toUpperCase();
    if (!id) return;
    if (await onAnalyze(id)) {
      setCveInput("");
      setReplayIndex(null);
      setSandboxHost(null);
      setSelectedCve(id);
    }
  };

  return (
    <div className="grid min-w-0 gap-4">
      <Card className="grid min-w-0 gap-2.5 p-2.5 lg:flex lg:flex-row lg:items-center lg:justify-between">
        <form onSubmit={handleAnalyze} className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-md">
          <div className="relative min-w-0 flex-1">
            <Crosshair aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary/70" />
            <Input
              aria-label="CVE ID"
              className="h-8 pl-9 font-mono text-xs"
              value={cveInput}
              onChange={(e) => setCveInput(e.target.value)}
              placeholder="CVE-2020-14343"
              required
              spellCheck="false"
            />
          </div>
          <Button size="sm" className="h-8 font-mono text-xs font-semibold tracking-wider uppercase">
            Analyze
          </Button>
        </form>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 lg:justify-end">
          {cveList.length > 0 && (
            <div role="tablist" aria-label="Tracked vulnerabilities" className="flex max-w-full items-center gap-1.5 overflow-x-auto py-0.5">
              {cveList.slice(0, 6).map((c) => {
                const selected = c.id === activeCveId;
                const tone = cveTone(c, data.findings);
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => { setSelectedCve(c.id); setReplayIndex(null); setSandboxHost(null); }}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-xs transition-colors ${
                      selected
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span aria-hidden="true" className={`size-1.5 rounded-full ${DOT_CLASS[tone]}`} />
                    {c.id}
                  </button>
                );
              })}
            </div>
          )}

          {scene.fullTimelineLength > 1 && (
            replayIndex !== null ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 border-primary/50 font-mono text-xs uppercase tracking-wider text-primary"
                onClick={() => setReplayIndex(null)}
              >
                <Square aria-hidden="true" className="size-3" />
                Live ({replayIndex + 1}/{scene.fullTimelineLength})
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 font-mono text-xs uppercase tracking-wider"
                onClick={() => setReplayIndex(0)}
              >
                <Play aria-hidden="true" className="size-3" />
                Replay
              </Button>
            )
          )}
        </div>
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]">
        <GraphicsStage scene={scene} onSelectFinding={setInspected} onSelectSandboxHost={setSandboxHost} />
        <AgentTerminal lines={scene.terminalLines} working={scene.working} cveId={activeCveId} />
      </div>

      <FindingDetails f={inspected} onClose={() => setInspected(null)} />
    </div>
  );
}
