import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Crosshair, Play, Power, Square } from "lucide-react";
import AgentTerminal from "./AgentTerminal.jsx";
import FindingDetails from "./FindingDetails.jsx";
import GraphicsStage from "./GraphicsStage.jsx";
import { deriveScene } from "./graphicsState.js";
import { useEvents } from "./useEvents.js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const STEPS = [
  { n: "01", label: "New Threat" },
  { n: "02", label: "Agent 1 · Check Servers" },
  { n: "03", label: "Agent 2 · Test Fix" },
  { n: "04", label: "Agent 3 · Simulate Attack" },
];

function cveTone(cve, findings) {
  if (cve.status === "new" || cve.status === "evaluating") return "active";
  const list = findings.filter((f) => f.cve_id === cve.id);
  const busy = list.some((f) =>
    ["queued", "running"].includes(f.remediation?.status) || f.exploit?.status === "running"
  );
  if (busy) return "active";
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

  // Build ordered list of known CVEs (newest live event or newest seen CVE first)
  const cveList = useMemo(() => {
    const map = new Map();
    for (const c of data.cves) map.set(c.id, c);
    for (let i = rawEvents.length - 1; i >= 0; i--) {
      const id = rawEvents[i].cve_id;
      if (id && !map.has(id)) map.set(id, { id, title: "", status: "evaluating" });
    }
    return [...map.values()];
  }, [data.cves, rawEvents]);

  // Auto-focus when a brand-new CVE arrives or starts evaluating (unless user is watching a replay)
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

  // Step-by-step replay timer
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
      setSelectedCve(id);
    }
  };

  return (
    <div className="grid min-w-0 gap-4">
      {/* Top Bar: Trigger CVE + CVE Switcher + Replay */}
      <Card className="grid min-w-0 gap-2.5 p-2.5 lg:flex lg:flex-row lg:items-center lg:justify-between">
        <form onSubmit={handleAnalyze} className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-md">
          <div className="relative min-w-0 flex-1">
            <Crosshair aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary/70" />
            <Input
              aria-label="CVE ID"
              className="h-8 pl-9 font-mono text-xs"
              value={cveInput}
              onChange={(e) => setCveInput(e.target.value)}
              placeholder="CVE-2024-22195"
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

      {/* Pipeline Stepper + Live Plain-English Narrator */}
      <Card className={`grid gap-3 border-l-2 px-4 py-3 transition-colors ${
        !scene.working && scene.outcomeTone === "safe"
          ? "border-not-affected/50 border-l-not-affected bg-not-affected/[0.06]"
          : !scene.working && scene.outcomeTone === "warn"
            ? "border-likely/55 border-l-likely bg-likely/[0.07]"
            : "border-l-primary"
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ol className="flex flex-wrap items-center gap-1.5 sm:gap-2" aria-label="Pipeline stage">
            {STEPS.map((s, idx) => {
              const stepNum = idx + 1;
              const isShutdownStep = stepNum === 4 && Boolean(scene.containment);
              const label = isShutdownStep ? "Auto-Shut Down VM" : s.label;
              const done = scene.stage > stepNum || (scene.stage === stepNum && !scene.working);
              const current = scene.stage === stepNum && scene.working;
              const cls = isShutdownStep
                ? "border-likely/60 bg-likely/15 text-likely"
                : current
                  ? "border-primary bg-primary/15 text-primary"
                  : done
                    ? "border-not-affected/45 bg-not-affected/10 text-not-affected"
                    : "border-border bg-background/50 text-muted-foreground";
              return (
                <li
                  key={s.n}
                  className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${cls}`}
                >
                  <span className="opacity-70">{s.n}</span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>

          <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-not-affected" />Safe
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-likely" />Shut down / Likely
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-affected" />Affected
            </span>
          </div>
        </div>

        <p role="status" className="flex items-start gap-2 text-sm font-medium text-foreground">
          {!scene.working && scene.outcomeTone === "safe" && (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-not-affected" />
          )}
          {!scene.working && scene.outcomeTone === "warn" && (
            <Power aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-likely" />
          )}
          <span>{scene.headline}</span>
        </p>
      </Card>

      {/* Main Split View: Visual Cyber Stage + Live Agent CMD */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <GraphicsStage scene={scene} onSelectFinding={setInspected} onSelectSandboxHost={setSandboxHost} />
        <AgentTerminal lines={scene.terminalLines} working={scene.working} cveId={activeCveId} />
      </div>

      <FindingDetails f={inspected} onClose={() => setInspected(null)} />
    </div>
  );
}
