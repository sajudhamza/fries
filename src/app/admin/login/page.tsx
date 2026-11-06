import { redirect } from "next/navigation";
import { LogoLockup, Notice } from "@/components/ui";
import { login } from "@/lib/admin-actions";
import { isAdmin } from "@/lib/session";

export const metadata = { title: "Admin sign in" };

export default function AdminLogin({ searchParams }: { searchParams: { error?: string } }) {
  if (isAdmin()) redirect("/admin");
  return (
    <main className="grid min-h-screen place-items-center bg-forest bg-candle px-4">
      <form action={login} className="card w-full max-w-sm space-y-5 p-7">
        <div className="text-center">
          <LogoLockup taglines={false} className="text-[64px]" />
          <h1 className="mt-5 font-serif text-xs font-bold uppercase tracking-caps text-forest/70">Host console</h1>
          <p className="mt-1 text-sm text-forest/70">Create locations and print their QR codes.</p>
        </div>
        {searchParams.error && <Notice tone="error">That password didn&apos;t match.</Notice>}
        <label className="block">
          <span className="label">Password</span>
          <input name="password" type="password" className="input" autoFocus required autoComplete="current-password" />
        </label>
        <button className="btn-primary w-full">Sign in</button>
      </form>
    </main>
  );
}
