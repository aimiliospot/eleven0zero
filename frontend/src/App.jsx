import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import Dashboard from "./Dashboard.jsx";
import Settings from "./Settings.jsx";

const currentPage = () => (location.hash === "#/settings" ? "settings" : "dash");

export default function App() {
  const [data, setData] = useState({ findings: [], vms: [], cves: [] });
  const [toast, setToast] = useState(null);
  const [live, setLive] = useState(true);
  const [page, setPage] = useState(currentPage);
  useEffect(() => {
    const onHashChange = () => setPage(currentPage());
    addEventListener("hashchange", onHashChange);
    return () => removeEventListener("hashchange", onHashChange);
  }, []);
  const notify = (ok, msg) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 3500); };

  const refresh = useCallback(() => api("/state").then((d) => { setData(d); setLive(true); }).catch(() => setLive(false)), []);
  useEffect(() => { refresh(); const t = setInterval(refresh, 5000); return () => clearInterval(t); }, [refresh]);

  // runs fn, toasts the result, resolves true on success so callers can clear their input
  const run = (fn, okMsg) => async (...args) => {
    try { await fn(...args); notify(true, okMsg); refresh(); return true; }
    catch (e) { notify(false, e.message); return false; }
  };
  const analyze = run((id) => api(`/replay/${encodeURIComponent(id)}`, "POST"), "Analysis started — results appear shortly");
  const addHost = run((h) => api("/hosts", "POST", { host: h }), "VM added — collecting inventory");
  const removeHost = run((h) => api("/hosts", "DELETE", { host: h }), "VM removed");

  return (
    <>
      <header className="site-header">
        <h1>eleven0zero</h1>
        <div className="row">
          <nav className="row">
            <a className={`navlink ${page === "dash" ? "on" : ""}`} href="#/">Dashboard</a>
            <a className={`navlink ${page === "settings" ? "on" : ""}`} href="#/settings">Settings</a>
          </nav>
          <span role="status" className={`live ${live ? "" : "off"}`}><i /> {live ? "Live" : "Offline"}</span>
        </div>
      </header>
      <main>
        {page === "settings"
          ? <Settings notify={notify} />
          : <Dashboard data={data} onAnalyze={analyze} onAddHost={addHost} onRemoveHost={removeHost} />}
      </main>
      {toast && <div role={toast.ok ? "status" : "alert"} className={`toast ${toast.ok ? "" : "bad"}`}>{toast.msg}</div>}
    </>
  );
}
