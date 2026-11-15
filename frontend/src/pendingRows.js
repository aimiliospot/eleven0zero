// Table rows for CVEs that are still being evaluated: one per VM that has no finding for that CVE yet.
// Self-check: node src/pendingRows.check.js
export const isPending = (cve) => cve.status === "new" || cve.status === "evaluating";

export function pendingRows({ cves, vms, findings }) {
  const done = new Set(findings.map((f) => `${f.cve_id} ${f.host}`));
  const hosts = vms.length ? vms.map((v) => v.host) : ["—"];
  return cves.filter(isPending).flatMap((c) =>
    hosts.filter((h) => !done.has(`${c.id} ${h}`))
      .map((h) => ({ cve_id: c.id, host: h, title: c.title, created_at: c.seen_at, verdict: "evaluating", pending: true })));
}
