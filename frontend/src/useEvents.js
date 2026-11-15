import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";

// ponytail: polls /events every second and keeps the last 100; the backend returns 200 at a time, so a long history catches up over a few ticks
export function useEvents() {
  const [events, setEvents] = useState([]);
  const since = useRef(0);
  useEffect(() => {
    const tick = () => api(`/events?since=${since.current}`).then(({ events: fresh }) => {
      if (!fresh.length) return;
      since.current = fresh[fresh.length - 1].id;
      setEvents((old) => [...old, ...fresh].slice(-300));
    }).catch(() => {});
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return events;
}
