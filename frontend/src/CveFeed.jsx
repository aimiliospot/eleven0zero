import { Button } from "@/components/ui/button";

export default function CveFeed({ cves, onAnalyze }) {
  return (
    <section>
      <h2>Latest CVEs</h2>
      {cves.length ? (
        <ul className="card feed">
          {cves.map((c) => (
            <li key={c.id} className="feed-row">
              <div className="grow">
                <a className="cve-id" href={`https://www.cve.org/CVERecord?id=${c.id}`} target="_blank" rel="noreferrer">{c.id}</a>
                <div className="title sm">{c.title}</div>
                {c.status === "skipped" && <div className="note">No VM inventory yet</div>}
              </div>
              <span className={`status ${c.status}`}>{c.status}</span>
              <Button variant="outline" size="xs" aria-label={`Analyze ${c.id}`} disabled={c.status === "evaluating"} onClick={() => onAnalyze(c.id)}>
                {c.status === "evaluating" ? "Evaluating…" : "Analyze"}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty small">Waiting for the feed…</p>
      )}
    </section>
  );
}
