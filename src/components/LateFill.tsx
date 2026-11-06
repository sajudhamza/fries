"use client";

import { useEffect, useState } from "react";
import { videoDetailsReady } from "@/lib/join-actions";

/**
 * Shown on the review form when the video hasn't been read yet (a slow worker run). Polls until
 * the details land, then reloads the form, unless the guest has started typing, in which case
 * it asks first so nothing they typed is lost.
 */
export function LateFill({ code, formId }: { code: string; formId: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    let dirty = false;
    const markDirty = () => { dirty = true; };
    form?.addEventListener("input", markDirty);
    const started = Date.now();
    const id = setInterval(async () => {
      if (Date.now() - started > 10 * 60_000) return clearInterval(id);
      try {
        if (await videoDetailsReady(code)) {
          clearInterval(id);
          if (dirty) setReady(true);
          else window.location.reload();
        }
      } catch { /* try again */ }
    }, 4000);
    return () => { clearInterval(id); form?.removeEventListener("input", markDirty); };
  }, [code, formId]);

  if (ready) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-forest/20 bg-forest/10 px-4 py-3 text-sm">
        <span>We finished reading your video.</span>
        <button type="button" className="btn-primary px-4 py-1.5" onClick={() => window.location.reload()}>Fill it in</button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-forest/15 bg-cream-light px-4 py-3 text-sm text-forest/80">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-forest/20 border-t-forest" />
      Still reading your video. We&apos;ll fill this in as soon as it&apos;s done, or you can type it yourself.
    </div>
  );
}
