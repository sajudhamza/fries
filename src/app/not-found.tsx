import { Brand } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <Brand />
        <p className="mt-8 font-display text-4xl leading-none">Nothing at this table</p>
        <p className="mt-2 text-forest/70">This code or profile doesn&apos;t exist, or it was deleted when the event ended.</p>
      </div>
    </main>
  );
}
