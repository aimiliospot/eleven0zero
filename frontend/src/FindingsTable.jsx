import { useState } from "react";
import { VERDICTS } from "./verdicts.js";
import { pendingRows } from "./pendingRows.js";
import FindingDetails from "./FindingDetails.jsx";
import VerdictBadge from "./VerdictBadge.jsx";
import CveLink from "./CveLink.jsx";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

const NO_FILTERS = { host: "", cve: "", from: "", to: "", verdict: "all" };
const startOfDay = (d) => (d ? new Date(d + "T00:00:00") : null); // date inputs are local days
const contains = (text, query) => text.toLowerCase().includes(query.trim().toLowerCase());

const ROW_EDGE = {
  affected: "border-l-2 border-l-affected bg-affected/[0.025]",
  likely: "border-l-2 border-l-likely",
  not_affected: "border-l-2 border-l-not-affected/45",
  evaluating: "border-l-2 border-l-primary",
  error: "border-l-2 border-l-border",
};

function PipelineTags({ f }) {
  const rem = f.remediation?.status;
  const exp = f.exploit?.status;
  return (
    <>
      {(rem === "queued" || rem === "running") && (
        <Badge variant="outline" className="text-primary"><Spinner aria-hidden="true" />Fixing</Badge>
      )}
      {rem === "passed" && <Badge variant="not_affected">Fix passed</Badge>}
      {(rem === "failed" || rem === "error") && <Badge variant="affected">Fix failed</Badge>}
      {exp === "running" && (
        <Badge variant="outline" className="text-primary"><Spinner aria-hidden="true" />PoC</Badge>
      )}
      {exp === "patched" && <Badge variant="not_affected">PoC blocked</Badge>}
      {exp === "vulnerable" && <Badge variant="affected">Exploitable</Badge>}
    </>
  );
}

export default function FindingsTable({ findings, cves, vms }) {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [selected, setSelected] = useState(null);
  const setFilter = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const rows = [...pendingRows({ cves, vms, findings }), ...findings]; // evaluating rows first
  const from = startOfDay(filters.from);
  const to = startOfDay(filters.to) && new Date(startOfDay(filters.to).getTime() + 864e5); // "to" includes the whole day
  const shown = rows.filter((f) => {
    const t = f.created_at && new Date(f.created_at);
    return contains(f.host, filters.host) && contains(f.cve_id, filters.cve)
      && (filters.verdict === "all" || f.verdict === filters.verdict)
      && (!from || (t && t >= from)) && (!to || (t && t < to));
  });

  return (
    <section className="grid min-w-0 gap-3">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-mono text-xs font-semibold tracking-wider uppercase text-muted-foreground">Findings</h2>
          {rows.length > 0 && (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {isFiltered ? `${shown.length}/${rows.length}` : rows.length}
            </span>
          )}
        </div>
        {isFiltered && (
          <Button variant="ghost" size="xs" className="font-mono uppercase tracking-wider" onClick={() => setFilters(NO_FILTERS)}>
            Clear filters
          </Button>
        )}
      </div>
      {rows.length ? (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="grid gap-2 border-b border-border/80 bg-muted/45 p-2.5 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto_150px]">
            <Input
              className="h-8 font-mono text-xs"
              placeholder="Filter VM…"
              aria-label="Filter by VM"
              value={filters.host}
              onChange={(e) => setFilter("host")(e.target.value)}
            />
            <Input
              className="h-8 font-mono text-xs"
              placeholder="Filter CVE…"
              aria-label="Filter by CVE"
              value={filters.cve}
              onChange={(e) => setFilter("cve")(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                className="h-8 font-mono text-xs"
                type="date"
                aria-label="From date"
                value={filters.from}
                onChange={(e) => setFilter("from")(e.target.value)}
              />
              <Input
                className="h-8 font-mono text-xs"
                type="date"
                aria-label="To date"
                value={filters.to}
                onChange={(e) => setFilter("to")(e.target.value)}
              />
            </div>
            <Select value={filters.verdict} onValueChange={setFilter("verdict")}>
              <SelectTrigger size="sm" className="w-full font-mono text-xs" aria-label="Filter by result">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All results</SelectItem>
                <SelectItem value="evaluating">Evaluating</SelectItem>
                {Object.entries(VERDICTS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/25 hover:bg-muted/25">
                <TableHead>VM</TableHead>
                <TableHead>CVE</TableHead>
                <TableHead>Evaluated</TableHead>
                <TableHead>Result</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!shown.length && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No findings match the filters</TableCell>
                </TableRow>
              )}
              {shown.map((f) => (
                <TableRow
                  key={f.cve_id + f.host}
                  onClick={() => !f.pending && setSelected(f)}
                  className={`${ROW_EDGE[f.verdict] || ROW_EDGE.error} ${!f.pending ? "cursor-pointer" : ""}`}
                >
                  <TableCell className="font-mono text-[13px] font-medium">{f.host}</TableCell>
                  <TableCell className="max-w-[260px]">
                    <div className="flex flex-col">
                      <CveLink id={f.cve_id} onClick={(e) => e.stopPropagation()} />
                      {f.title && <span className="truncate text-xs text-muted-foreground">{f.title}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                    {f.pending ? "—" : new Date(f.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {f.pending ? (
                      <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-primary">
                        <Spinner aria-hidden="true" />Evaluating
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <VerdictBadge verdict={f.verdict} />
                        <PipelineTags f={f} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!f.pending && (
                      <Button
                        variant="outline"
                        size="xs"
                        className="font-mono uppercase tracking-wider"
                        onClick={(e) => { e.stopPropagation(); setSelected(f); }}
                      >
                        Details
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-card/50 px-5 py-11 text-center text-sm text-muted-foreground">
          No findings yet. Analyze a CVE or wait for the next feed poll.
        </p>
      )}
      <FindingDetails f={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
