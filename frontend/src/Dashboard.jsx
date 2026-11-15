import { useState } from "react";
import { Crosshair } from "lucide-react";
import FindingsTable from "./FindingsTable.jsx";
import VmPanel from "./VmPanel.jsx";
import CveFeed from "./CveFeed.jsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const TONE = {
  affected: { value: "text-affected", accent: "border-t-affected" },
  likely: { value: "text-likely", accent: "border-t-likely" },
  not_affected: { value: "text-not-affected", accent: "border-t-not-affected" },
  neutral: { value: "text-foreground", accent: "border-t-primary/50" },
};

function Stat({ label, value, tone = "neutral", alert = false }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <Card className={`flex-col-reverse gap-1.5 border-t-2 px-4 py-3.5 ${t.accent} ${alert ? "border-affected/40 bg-affected/[0.04]" : ""}`}>
      <dt className="font-mono text-[11px] tracking-wider uppercase text-muted-foreground">{label}</dt>
      <dd className={`font-mono text-3xl font-semibold tabular-nums leading-none ${t.value}`}>{value}</dd>
    </Card>
  );
}

export default function Dashboard({ data, onAnalyze, onAddHost, onRemoveHost }) {
  const [cve, setCve] = useState("");
  const count = (verdict) => data.findings.filter((f) => f.verdict === verdict).length;
  const affectedCount = count("affected");

  return (
    <div className="grid min-w-0 gap-6">
      <dl className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Affected" value={affectedCount} tone="affected" alert={affectedCount > 0} />
        <Stat label="Likely" value={count("likely")} tone="likely" />
        <Stat label="Not affected" value={count("not_affected")} tone="not_affected" />
        <Stat label="VMs monitored" value={data.vms.length} />
        <Stat label="CVEs seen" value={data.cves.length} />
      </dl>

      <Card className="min-w-0 flex-row items-center gap-2 p-2.5">
        <form
          className="flex w-full min-w-0 items-center gap-2"
          onSubmit={async (e) => { e.preventDefault(); if (cve.trim() && await onAnalyze(cve.trim())) setCve(""); }}
        >
          <div className="relative min-w-0 flex-1">
            <Crosshair aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary/70" />
            <Input
              aria-label="CVE ID"
              className="pl-9 font-mono"
              value={cve}
              onChange={(e) => setCve(e.target.value)}
              placeholder="CVE-2020-14343"
              required
              spellCheck="false"
            />
          </div>
          <Button className="font-mono text-xs font-semibold tracking-wider uppercase">Analyze</Button>
        </form>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <FindingsTable findings={data.findings} cves={data.cves} vms={data.vms} />
        <aside className="grid min-w-0 gap-6">
          <VmPanel vms={data.vms} onAdd={onAddHost} onRemove={onRemoveHost} />
          <CveFeed cves={data.cves} onAnalyze={onAnalyze} />
        </aside>
      </div>
    </div>
  );
}
