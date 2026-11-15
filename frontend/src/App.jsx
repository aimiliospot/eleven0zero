import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "./api.js";
import Dashboard from "./Dashboard.jsx";
import Graphics from "./Graphics.jsx";
import Settings from "./Settings.jsx";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

const PAGE_HASH = { dash: "#/", graphics: "#/graphics", settings: "#/settings" };
const currentPage = () => Object.keys(PAGE_HASH).find((p) => PAGE_HASH[p] === location.hash) ?? "dash";
const notify = (ok, msg) => (ok ? toast.success(msg) : toast.error(msg));

export default function App() {
  const [data, setData] = useState({ findings: [], vms: [], cves: [] });
  const [live, setLive] = useState(true);
  const [page, setPage] = useState(currentPage);
  useEffect(() => {
    const onHashChange = () => setPage(currentPage());
    addEventListener("hashchange", onHashChange);
    return () => removeEventListener("hashchange", onHashChange);
  }, []);

  const refresh = useCallback(() => api("/state").then((d) => { setData(d); setLive(true); }).catch(() => setLive(false)), []);
  // ponytail: 1s on Graphics for crisp animations, 2s elsewhere; switch to SSE if true push is needed
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, page === "graphics" ? 1000 : 2000);
    return () => clearInterval(t);
  }, [refresh, page]);

  // runs fn, toasts the result, resolves true on success so callers can clear their input
  const run = (fn, okMsg) => async (...args) => {
    try { await fn(...args); notify(true, okMsg); refresh(); return true; }
    catch (e) { notify(false, e.message); return false; }
  };
  const analyze = run((id) => api(`/replay/${encodeURIComponent(id)}`, "POST"), "Analysis started");
  const addHost = run((h) => api("/hosts", "POST", { host: h }), "VM added — collecting inventory");
  const removeHost = run((h) => api("/hosts", "DELETE", { host: h }), "VM removed");

  return (
    <Tabs value={page} onValueChange={(p) => { location.hash = PAGE_HASH[p]; }} className="min-h-screen w-full min-w-0 gap-0 overflow-x-clip">
      <header className="sticky top-0 z-30 border-b border-border/90 bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-sm border border-primary/35 bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </span>
            <h1 className="font-mono text-base font-semibold tracking-tight text-foreground">eleven0zero</h1>
            <Badge variant={live ? "not_affected" : "affected"} role="status">
              <span aria-hidden="true" className={`size-1.5 rounded-full bg-current ${live ? "animate-pulse" : ""}`} />
              {live ? "Live" : "Offline"}
            </Badge>
          </div>
          <TabsList>
            <TabsTrigger value="dash" className="px-2.5 font-mono text-xs uppercase tracking-wider sm:px-3">Dashboard</TabsTrigger>
            <TabsTrigger value="graphics" className="px-2.5 font-mono text-xs uppercase tracking-wider sm:px-3">Graphics</TabsTrigger>
            <TabsTrigger value="settings" className="px-2.5 font-mono text-xs uppercase tracking-wider sm:px-3">Settings</TabsTrigger>
          </TabsList>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-[1600px] px-4 pt-6 pb-16 sm:px-5">
        <TabsContent value="dash" className="min-w-0">
          <Dashboard data={data} onAnalyze={analyze} onAddHost={addHost} onRemoveHost={removeHost} />
        </TabsContent>
        <TabsContent value="graphics" className="min-w-0">
          <Graphics data={data} onAnalyze={analyze} />
        </TabsContent>
        <TabsContent value="settings" className="min-w-0"><Settings notify={notify} /></TabsContent>
      </main>
      <Toaster position="bottom-center" />
    </Tabs>
  );
}
