export default function CveLink({ id, onClick }) {
  return (
    <a
      className="font-mono text-[13px] font-semibold text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
      href={`https://www.cve.org/CVERecord?id=${id}`}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
    >
      {id}
    </a>
  );
}
