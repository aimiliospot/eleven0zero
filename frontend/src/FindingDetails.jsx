import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VERDICTS, verdictOf } from "./verdicts.js";
import VerdictBadge from "./VerdictBadge.jsx";
import CveLink from "./CveLink.jsx";

const Tick = ({ ok }) => <Badge variant={ok ? "not_affected" : "affected"}>{ok ? "Yes" : "No"}</Badge>;
const Section = ({ title, children }) => (
  <section className="grid gap-2 border-t border-border/70 pt-4">
    <h4 className="font-mono text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">{title}</h4>
    {children}
  </section>
);
const None = ({ what }) => <p className="text-sm text-muted-foreground">{what} not run</p>;

const STAGE_TONE = {
  ok: "border-not-affected/40 bg-not-affected/[0.05]",
  bad: "border-affected/40 bg-affected/[0.05]",
  warn: "border-likely/40 bg-likely/[0.05]",
  active: "border-primary/40 bg-primary/[0.05]",
  idle: "border-border bg-muted/30",
};

function Stage({ step, label, state, detail, tone = "idle" }) {
  return (
    <li className={`grid gap-0.5 rounded-md border px-3 py-2.5 ${STAGE_TONE[tone] || STAGE_TONE.idle}`}>
      <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">{step} · {label}</span>
      <span className="font-mono text-sm font-semibold capitalize text-foreground">{state}</span>
      <span className="truncate font-mono text-[11px] text-muted-foreground">{detail}</span>
    </li>
  );
}

function PipelineStrip({ f }) {
  const vKey = verdictOf(f.verdict);
  const vTone = vKey === "affected" ? "bad" : vKey === "likely" ? "warn" : vKey === "not_affected" ? "ok" : "idle";
  const r = f.remediation;
  const isShutdown = r?.status === "auto_shutdown";
  const rTone = !r ? "idle" : isShutdown ? "warn" : r.status === "passed" ? "ok" : (r.status === "running" || r.status === "queued") ? "active" : (r.status === "failed" || r.status === "error" || r.status === "shutdown_failed") ? "bad" : "idle";
  const rState = !r ? "Not run" : isShutdown ? "Auto-shut down" : r.status;
  const rDetail = !r ? "—" : isShutdown ? `CVSS ${r.cvss} ≥ ${r.threshold} threshold` : r.status === "passed" ? "Fix + services verified" : r.snapshot || r.status;
  const e = f.exploit;
  const eTone = isShutdown ? "warn" : !e ? "idle" : e.status === "patched" ? "ok" : e.status === "vulnerable" ? "bad" : e.status === "running" ? "active" : "idle";
  const eDetail = isShutdown ? "Skipped — VM stopped immediately" : !e ? "—" : e.status === "patched" ? "PoC blocked on clone" : e.status === "vulnerable" ? "PoC succeeded" : e.language || e.status;

  return (
    <ol className="grid gap-2 sm:grid-cols-3" aria-label="Verification pipeline">
      <Stage
        step="01"
        label="Jury verdict"
        state={VERDICTS[vKey].label}
        detail={`${Math.round(f.confidence * 100)}% confidence · ${f.votes?.length || 0} vote${f.votes?.length === 1 ? "" : "s"}`}
        tone={vTone}
      />
      <Stage step="02" label={isShutdown ? "Containment" : "Sandbox fix"} state={rState} detail={rDetail} tone={rTone} />
      <Stage step="03" label="Exploit check" state={isShutdown ? "Skipped" : (e ? e.status : "Not run")} detail={eDetail} tone={eTone} />
    </ol>
  );
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

function Evidence({ text }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="flex items-start justify-between gap-2">
      <span className={`text-xs text-muted-foreground ${open ? "max-w-md whitespace-normal break-words" : "max-w-52 truncate"}`}>{text}</span>
      <Button variant="ghost" size="xs" className="font-mono uppercase tracking-wider" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide" : "Show"}
      </Button>
    </div>
  );
}

export default function FindingDetails({ f, onClose }) {
  const r = f?.remediation, e = f?.exploit;
  return (
    <Dialog open={!!f} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-border bg-card sm:max-w-3xl">
        {f && (
          <>
            <DialogHeader className="gap-1.5">
              <div className="flex flex-wrap items-center gap-2 pr-6">
                <VerdictBadge verdict={f.verdict} />
                {f.cvss != null && (
                  <Badge variant={f.cvss >= 9.0 ? "affected" : f.cvss >= 7.0 ? "likely" : "secondary"}>
                    CVSS {f.cvss}
                  </Badge>
                )}
                {r?.status === "auto_shutdown" && <Badge variant="likely">⏻ Auto-shut down</Badge>}
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{Math.round(f.confidence * 100)}% confidence</span>
              </div>
              <DialogTitle className="flex flex-wrap items-center gap-2 font-mono text-base">
                <CveLink id={f.cve_id} />
                <span className="text-muted-foreground">·</span>
                <span>{f.host}</span>
              </DialogTitle>
              <DialogDescription>{f.title}</DialogDescription>
            </DialogHeader>

            <PipelineStrip f={f} />

            <Section title="Model evaluations">
              {f.votes?.length ? (
                <div className="overflow-hidden rounded-md border border-border/80 bg-background/50">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead>Model</TableHead>
                        <TableHead>Verdict</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Evidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {f.votes.map((v) => (
                        <TableRow key={v.model}>
                          <TableCell><code>{v.model}</code></TableCell>
                          {v.error ? (
                            <TableCell colSpan={3}>
                              <Badge variant="affected">Failed</Badge>{" "}
                              <span className="text-xs text-muted-foreground">{v.error}</span>
                            </TableCell>
                          ) : (
                            <>
                              <TableCell><VerdictBadge verdict={v.verdict} /></TableCell>
                              <TableCell className="font-mono text-xs tabular-nums">{Math.round(v.confidence * 100)}%</TableCell>
                              <TableCell><Evidence text={v.evidence} /></TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-muted-foreground">No model data</p>}
            </Section>

            <Section title="Recommended actions">
              {f.actions?.length ? (
                <ol className="grid gap-1.5 rounded-md border border-border/80 bg-background/80 p-3 font-mono text-xs">
                  {f.actions.map((a, i) => (
                    <li key={i} className="flex gap-2.5 break-words">
                      <span className="select-none text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-primary">{a}</span>
                    </li>
                  ))}
                </ol>
              ) : <p className="text-sm text-muted-foreground">None</p>}
            </Section>

            <Section title={r?.status === "auto_shutdown" || r?.status === "shutdown_failed" ? "Emergency containment" : "Fix test"}>
              {r ? (
                r.status === "auto_shutdown" || r.status === "shutdown_failed" ? (
                  <div className="grid gap-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                      Status <Badge variant={r.status === "auto_shutdown" ? "likely" : "affected"}>{r.status === "auto_shutdown" ? "VM shut down immediately" : "Shutdown failed"}</Badge>
                      {r.cvss != null && r.threshold != null && (
                        <span className="font-mono text-xs">CVSS {r.cvss} ≥ threshold {r.threshold}</span>
                      )}
                    </div>
                    {r.cmd && (
                      <div className="rounded-md border border-border/80 bg-background/85 p-3 font-mono text-xs text-foreground">
                        $ {r.cmd}
                      </div>
                    )}
                    {r.error && <p className="font-mono text-xs text-destructive">{r.error}</p>}
                  </div>
                ) : (
                <div className="grid gap-2 text-sm">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <span className="flex items-center gap-1.5 text-muted-foreground">Status <Badge variant="outline">{r.status}</Badge></span>
                    {"fixed" in r && <span className="flex items-center gap-1.5 text-muted-foreground">Issue fixed <Tick ok={r.fixed} /></span>}
                    {"services_ok" in r && <span className="flex items-center gap-1.5 text-muted-foreground">Services healthy <Tick ok={r.services_ok} /></span>}
                  </div>
                  <div className="text-xs text-muted-foreground">Snapshot: {r.snapshot ? <code>{r.snapshot}</code> : "—"}</div>
                  {r.commands?.length > 0 && (
                    <div className="grid gap-1.5 rounded-md border border-border/80 bg-background/85 p-3 font-mono text-xs">
                      {r.commands.map((c, i) => (
                        <div key={i} className="grid gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="break-all text-foreground">$ {c.cmd}</span>
                            <Badge variant={c.rc === 0 ? "not_affected" : "affected"}>{c.rc === null ? "blocked" : `rc=${c.rc}`}</Badge>
                          </div>
                          {c.out && <pre className="overflow-x-auto whitespace-pre-wrap text-[11px] text-muted-foreground">{c.out}</pre>}
                        </div>
                      ))}
                    </div>
                  )}
                  {r.error && <p className="font-mono text-xs text-destructive">{r.error}</p>}
                </div>
                )
              ) : <None what="Remediation test" />}
            </Section>

            <Section title="Exploit">
              {e ? (
                <div className="grid gap-2 text-sm">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      Outcome <Badge variant={e.status === "patched" ? "not_affected" : e.status === "vulnerable" ? "affected" : "outline"}>{e.status}</Badge>
                    </span>
                    <span className="text-xs text-muted-foreground">File: {e.saved_path ? <code>{e.saved_path}</code> : "—"}</span>
                  </div>
                  {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
                  {e.error && <p className="font-mono text-xs text-destructive">{e.error}</p>}
                  {e.output && (
                    <pre className="overflow-x-auto rounded-md border border-border/80 bg-background/90 p-3 font-mono text-xs text-foreground">
                      <code>{e.output}</code>
                    </pre>
                  )}
                  {e.script && (
                    <Collapsible>
                      <div className="flex gap-2">
                        <CollapsibleTrigger asChild>
                          <Button type="button" variant="outline" size="xs" className="font-mono uppercase tracking-wider">Exploit script</Button>
                        </CollapsibleTrigger>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className="font-mono uppercase tracking-wider"
                          onClick={() => download(e.saved_path?.split(/[\\/]/).pop() || `${f.cve_id}_exploit.txt`, e.script)}
                        >
                          <Download />Download
                        </Button>
                      </div>
                      <CollapsibleContent>
                        <pre className="mt-2 overflow-x-auto rounded-md border border-border/80 bg-background/90 p-3 font-mono text-xs text-primary">
                          <code>{e.script}</code>
                        </pre>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              ) : <None what="Exploit" />}
            </Section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
