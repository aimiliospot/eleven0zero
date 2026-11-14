import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VERDICTS } from "./verdicts.js";

const Tick = ({ ok }) => <Badge variant={ok ? "secondary" : "destructive"}>{ok ? "✓ yes" : "✗ no"}</Badge>;
const Section = ({ title, children }) => (
  <section className="grid gap-1.5">
    <h4 className="text-xs uppercase tracking-widest text-muted-foreground">{title}</h4>
    {children}
  </section>
);
const None = ({ what }) => <p className="text-sm text-muted-foreground">{what} not run</p>;

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
    <div className="flex items-start gap-2">
      <span className={open ? "max-w-80 whitespace-normal break-words" : "max-w-48 truncate"}>{text}</span>
      <Button variant="ghost" size="xs" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"}</Button>
    </div>
  );
}

export default function FindingDetails({ f, onClose }) {
  const r = f?.remediation, e = f?.exploit;
  return (
    <Dialog open={!!f} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {f && (
          <>
            <DialogHeader>
              <DialogTitle>{f.cve_id} · {f.host}</DialogTitle>
              <DialogDescription>{f.title}</DialogDescription>
            </DialogHeader>

            <Section title="Model evaluations">
              {f.votes?.length ? (
                <>
                  <Table>
                    <TableHeader><TableRow><TableHead>Model</TableHead><TableHead>Verdict</TableHead><TableHead>Score</TableHead><TableHead>Evidence</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {f.votes.map((v) => (
                        <TableRow key={v.model}>
                          <TableCell><code>{v.model}</code></TableCell>
                          {v.error ? (
                            <TableCell colSpan={3}><Badge variant="destructive">failed</Badge> <span className="text-xs text-muted-foreground">{v.error}</span></TableCell>
                          ) : (
                            <>
                              <TableCell><span className={`badge ${v.verdict}`}>{(VERDICTS[v.verdict] || VERDICTS.error).label}</span></TableCell>
                              <TableCell>{Math.round(v.confidence * 100)}%</TableCell>
                              <TableCell><Evidence text={v.evidence} /></TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-sm text-muted-foreground">Overall: {(VERDICTS[f.verdict] || VERDICTS.error).label} at {Math.round(f.confidence * 100)}%</p>
                </>
              ) : <p className="text-sm text-muted-foreground">No model data</p>}
            </Section>

            <Section title="Recommended actions">
              {f.actions?.length
                ? <ol className="grid list-decimal gap-1.5 pl-5">{f.actions.map((a, i) => <li key={i}><code>{a}</code></li>)}</ol>
                : <p className="text-sm text-muted-foreground">None</p>}
            </Section>

            <Section title="Fix test">
              {r ? (
                <div className="grid gap-1.5 text-sm">
                  <div>Status <Badge variant="outline">{r.status}</Badge></div>
                  <div>Issue fixed: <Tick ok={r.fixed} /> · Services healthy: <Tick ok={r.services_ok} /></div>
                  <div>Snapshot: {r.snapshot ? <code>{r.snapshot}</code> : "—"}</div>
                  {r.error && <p className="text-destructive">{r.error}</p>}
                </div>
              ) : <None what="Remediation test" />}
            </Section>

            <Section title="Exploit">
              {e ? (
                <div className="grid gap-1.5 text-sm">
                  <div>File: {e.saved_path ? <code>{e.saved_path}</code> : "—"}</div>
                  <div>Outcome <Badge variant={e.status === "patched" ? "secondary" : "destructive"}>{e.status}</Badge></div>
                  {e.notes && <p className="text-muted-foreground">{e.notes}</p>}
                  {e.error && <p className="text-destructive">{e.error}</p>}
                  {e.output && <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs"><code>{e.output}</code></pre>}
                  {e.script && (
                    <details>
                      <summary className="cursor-pointer text-muted-foreground">Exploit script</summary>
                      <Button type="button" variant="outline" size="xs" className="mt-1"
                        onClick={() => download(e.saved_path?.split(/[\\/]/).pop() || `${f.cve_id}_exploit.txt`, e.script)}>
                        Download
                      </Button>
                      <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-2 text-xs"><code>{e.script}</code></pre>
                    </details>
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
