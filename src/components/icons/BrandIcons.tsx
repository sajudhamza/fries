/** Line icons in the style of the brand deck's "secondary elements" (cocktail, plate, cheers, table). */
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function IconVideo(p: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={p.className} {...base}>
      <rect x="4" y="9" width="17" height="14" rx="3" />
      <path d="M21 14l7-4v12l-7-4" />
    </svg>
  );
}
export function IconPeople(p: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={p.className} {...base}>
      <circle cx="11" cy="11" r="4" />
      <circle cx="22" cy="12" r="3.2" />
      <path d="M3.5 25c1-4.2 4-6.5 7.5-6.5s6.5 2.3 7.5 6.5M18 20.2c1.1-.6 2.4-.9 4-.9 3 0 5.4 1.9 6.3 5.7" />
    </svg>
  );
}
export function IconCheers(p: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={p.className} {...base}>
      <path d="M7 5h7l-1 7a3 3 0 01-5 0L7 5zM10.5 14v9M7.5 23h6M18 5h7l-1 7a3 3 0 01-5 0L18 5zM21.5 14v9M18.5 23h6" />
      <path d="M14.5 3l1.5-1.5M16 5.5l2-.5" />
    </svg>
  );
}
export function IconTable(p: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={p.className} {...base}>
      <ellipse cx="16" cy="13" rx="11" ry="3.5" />
      <path d="M16 16.5V27M11 27h10M6 21l-2 6M26 21l2 6" />
      <path d="M13 8.5c0-1.5 1.3-2.5 3-2.5s3 1 3 2.5" />
    </svg>
  );
}
export function IconMartini(p: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={p.className} {...base}>
      <path d="M6 6h20L16 17 6 6zM16 17v9M11 26h10M20 4l3-2" />
      <circle cx="19" cy="10" r="1.2" />
    </svg>
  );
}
