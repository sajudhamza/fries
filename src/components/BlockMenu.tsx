import { ConfirmSubmit } from "./client";

/** Unmatch and block/report controls (plain forms, no JS needed beyond the confirm). */
export function BlockMenu({ blockAction, unmatchAction, name }: {
  blockAction: (formData: FormData) => Promise<void>;
  unmatchAction?: () => Promise<void>;
  name: string;
}) {
  return (
    <details className="relative">
      <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full text-xl text-forest/70 hover:bg-forest/5" aria-label="More">⋯</summary>
      <div className="absolute right-0 z-30 mt-2 w-72 space-y-3 rounded-2xl border border-forest/10 bg-cream-light p-4 shadow-lift">
        {unmatchAction && (
          <form action={unmatchAction}>
            <ConfirmSubmit className="btn-ghost w-full" message={`Unmatch with ${name}? Your chat will be deleted.`}>Unmatch</ConfirmSubmit>
          </form>
        )}
        <form action={blockAction} className="space-y-2">
          <label className="block">
            <span className="label">Block {name}</span>
            <select name="reason" className="input" defaultValue="">
              <option value="">Just block</option>
              <option value="inappropriate">Block &amp; report: inappropriate</option>
              <option value="harassment">Block &amp; report: harassment</option>
              <option value="fake">Block &amp; report: fake profile</option>
              <option value="underage">Block &amp; report: looks under 18</option>
              <option value="other">Block &amp; report: something else</option>
            </select>
          </label>
          <ConfirmSubmit className="btn-danger w-full" message={`Block ${name}? You won't see each other again at this event.`}>Block</ConfirmSubmit>
          <p className="text-xs text-forest/55">Reports go to the event host.</p>
        </form>
      </div>
    </details>
  );
}
