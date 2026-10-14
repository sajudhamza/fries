import { Brand } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-glow px-4 text-center">
      <div>
        <Brand />
        <p className="mt-8 font-display text-3xl font-bold">Nothing here</p>
        <p className="mt-2 text-haze-300">This code or profile doesn&apos;t exist, or it was deleted when the event ended.</p>
      </div>
    </main>
  );
}
