export const api = async (path, method = "GET", body) => {
  const r = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body && { "Content-Type": "application/json" }),
      "X-CSRFToken": document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "", // Django CSRF
    },
    body: body && JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
};
