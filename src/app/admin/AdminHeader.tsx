import { Brand } from "@/components/ui";
import { logout } from "@/lib/admin-actions";

export function AdminHeader() {
  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Brand href="/admin" small />
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs font-medium text-haze-300">Admin</span>
        </div>
        <form action={logout}>
          <button className="text-sm text-haze-300 hover:text-white">Sign out</button>
        </form>
      </div>
    </header>
  );
}
