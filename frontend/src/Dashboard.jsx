import { useState } from "react";
import FindingsTable from "./FindingsTable.jsx";
import VmPanel from "./VmPanel.jsx";
import CveFeed from "./CveFeed.jsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function Stat({ label, value, tone = "" }) {
  return (
    <div className={`stat ${tone}`}>
      <dt className="stat-label">{label}</dt>
      <dd className="stat-value">{value}</dd>
    </div>
  );
}

export default function Dashboard({ data, onAnalyze, onAddHost, onRemoveHost }) {
  const [cve, setCve] = useState("");
  const count = (verdict) => data.findings.filter((f) => f.verdict === verdict).length;
  const evaluating = data.cves.filter((c) => c.status === "evaluating").length;

  return (
    <>
      <dl className="stats">
        <Stat label="Affected" value={count("affected")} tone="affected" />
        <Stat label="Likely" value={count("likely")} tone="likely" />
        <Stat label="Not affected" value={count("not_affected")} tone="not_affected" />
        <Stat label="VMs monitored" value={data.vms.length} />
        <Stat label="CVEs seen" value={data.cves.length} />
      </dl>

      <form className="bar" onSubmit={async (e) => { e.preventDefault(); if (cve.trim() && await onAnalyze(cve.trim())) setCve(""); }}>
        <Input aria-label="CVE ID" value={cve} onChange={(e) => setCve(e.target.value)} placeholder="CVE-2024-6387" required spellCheck="false" />
        <Button>Analyze</Button>
        {evaluating > 0 && <span className="spin">Evaluating {evaluating}…</span>}
      </form>

      <div className="cols">
        <FindingsTable findings={data.findings} />
        <aside>
          <VmPanel vms={data.vms} onAdd={onAddHost} onRemove={onRemoveHost} />
          <CveFeed cves={data.cves} onAnalyze={onAnalyze} />
        </aside>
      </div>
    </>
  );
}
