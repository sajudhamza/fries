import { LocalTime } from "@/components/client";
import { Brand } from "@/components/ui";
import type { Location } from "@/lib/types";

export function PublicShell({ loc, children, wide = false }: { loc: Location; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-glow">
      <header className={`mx-auto flex items-center justify-between px-4 py-4 ${wide ? "max-w-4xl" : "max-w-md"}`}>
        <Brand href={`/l/${loc.code}`} small />
        <div className="text-right">
          <p className="max-w-[12rem] truncate text-sm font-semibold">{loc.name}</p>
          {!loc.endedAt && <p className="text-xs text-haze-500">until <LocalTime iso={loc.endsAt} mode="time" /></p>}
        </div>
      </header>
      <main className={`mx-auto px-4 pb-16 ${wide ? "max-w-4xl" : "max-w-md"}`}>{children}</main>
    </div>
  );
}
