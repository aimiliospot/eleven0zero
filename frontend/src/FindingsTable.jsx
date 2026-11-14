import { useState } from "react";
import { VERDICTS } from "./verdicts.js";
import FindingDetails from "./FindingDetails.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NO_FILTERS = { host: "", cve: "", from: "", to: "", verdict: "all" };
const startOfDay = (d) => (d ? new Date(d + "T00:00:00") : null); // date inputs are local days
const contains = (text, query) => text.toLowerCase().includes(query.trim().toLowerCase());

export default function FindingsTable({ findings }) {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [selected, setSelected] = useState(null);
  const setFilter = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const from = startOfDay(filters.from);
  const to = startOfDay(filters.to) && new Date(startOfDay(filters.to).getTime() + 864e5); // "to" includes the whole day
  const shown = findings.filter((f) => {
    const t = f.created_at && new Date(f.created_at);
    return contains(f.host, filters.host) && contains(f.cve_id, filters.cve)
      && (filters.verdict === "all" || f.verdict === filters.verdict)
      && (!from || (t && t >= from)) && (!to || (t && t < to));
  });

  return (
    <section>
      <div className="sec-head">
        <h2>Findings</h2>
        {isFiltered && <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>Clear filters</Button>}
      </div>
      {findings.length ? (
        <div className="card flush">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>VM</TableHead><TableHead>CVE</TableHead>
                <TableHead>Evaluated</TableHead><TableHead>Result</TableHead><TableHead />
              </TableRow>
              <TableRow>
                <TableHead><Input className="h-8" aria-label="Filter by VM" value={filters.host} onChange={(e) => setFilter("host")(e.target.value)} /></TableHead>
                <TableHead><Input className="h-8" aria-label="Filter by CVE" value={filters.cve} onChange={(e) => setFilter("cve")(e.target.value)} /></TableHead>
                <TableHead>
                  <div className="grid gap-1">
                    <Input className="h-8" type="date" aria-label="From date" value={filters.from} onChange={(e) => setFilter("from")(e.target.value)} />
                    <Input className="h-8" type="date" aria-label="To date" value={filters.to} onChange={(e) => setFilter("to")(e.target.value)} />
                  </div>
                </TableHead>
                <TableHead>
                  <Select value={filters.verdict} onValueChange={setFilter("verdict")}>
                    <SelectTrigger size="sm" className="w-full" aria-label="Filter by result"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {Object.entries(VERDICTS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!shown.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No findings match the filters</TableCell></TableRow>}
              {shown.map((f) => (
                <TableRow key={f.cve_id + f.host}>
                  <TableCell className="host">{f.host}</TableCell>
                  <TableCell><a className="cve-id" href={`https://www.cve.org/CVERecord?id=${f.cve_id}`} target="_blank" rel="noreferrer">{f.cve_id}</a></TableCell>
                  <TableCell>{f.created_at ? new Date(f.created_at).toLocaleString() : "pending"}</TableCell>
                  <TableCell><span className={`badge ${f.verdict}`}>{(VERDICTS[f.verdict] || VERDICTS.error).label}</span></TableCell>
                  <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => setSelected(f)}>Details</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="empty">No findings yet. Analyze a CVE or wait for the next feed poll.</p>
      )}
      <FindingDetails f={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
