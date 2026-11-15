import assert from "node:assert";
import { pendingRows } from "./pendingRows.js";

const cves = [{ id: "CVE-1", status: "evaluating" }, { id: "CVE-2", status: "evaluated" }, { id: "CVE-3", status: "new" }];
const vms = [{ host: "a" }, { host: "b" }];
const rows = pendingRows({ cves, vms, findings: [{ cve_id: "CVE-1", host: "a" }] });
assert.deepEqual(rows.map((r) => `${r.cve_id}@${r.host}`), ["CVE-1@b", "CVE-3@a", "CVE-3@b"]);
assert.deepEqual(pendingRows({ cves, vms: [], findings: [] }).map((r) => r.host), ["—", "—"]);
console.log("ok");
