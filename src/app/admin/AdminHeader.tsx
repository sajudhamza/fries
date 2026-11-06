import { Brand } from "@/components/ui";
import { logout } from "@/lib/admin-actions";

export function AdminHeader() {
  return (
    <header className="bg-forest text-cream">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Brand href="/admin" small tone="cream" />
          <span className="rounded-full border border-cream/30 px-2.5 py-0.5 font-serif text-[10px] font-bold uppercase tracking-caps text-cream/80">Host console</span>
        </div>
        <form action={logout}>
          <button className="text-sm text-cream/75 hover:text-cream">Sign out</button>
        </form>
      </div>
      <div className="h-2 bg-checker bg-[length:16px_16px]" aria-hidden />
    </header>
  );
}
