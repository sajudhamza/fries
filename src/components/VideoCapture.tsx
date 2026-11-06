"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { checkProcessing, finishUpload, requestUpload, skipProcessing } from "@/lib/join-actions";
import { VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, VIDEO_MIN_SECONDS, type FieldKey, type FieldMeta } from "@/lib/types";

type Phase = "choose" | "recording" | "uploading" | "processing" | "failed";
type Step = "upload" | "listen" | "extract" | "done";

interface Clip {
  blob: Blob;
  seconds: number;
  photo: string | null;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function pickMime(): string {
  const options = ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

/** Grabs a centred 4:5 still from a playing/seeked video element as a small JPEG data URL. */
function grabStill(video: HTMLVideoElement): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const targetRatio = 4 / 5;
  let sw = vw, sh = vh;
  if (vw / vh > targetRatio) sw = vh * targetRatio; else sh = vw / targetRatio;
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 600;
  canvas.getContext("2d")!.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, 480, 600);
  return canvas.toDataURL("image/jpeg", 0.8);
}

/** Reads duration + a still from an uploaded file. */
function inspectFile(file: File): Promise<{ seconds: number; photo: string | null }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = URL.createObjectURL(file);
    let seconds = 0;
    v.onloadedmetadata = () => {
      if (!Number.isFinite(v.duration)) {
        // Some recorded WebM files report Infinity until you seek past the end.
        v.currentTime = 1e7;
        v.ontimeupdate = () => {
          v.ontimeupdate = null;
          seconds = v.duration;
          v.currentTime = Math.min(3, seconds / 3);
        };
        return;
      }
      seconds = v.duration;
      v.currentTime = Math.min(3, seconds / 3);
    };
    v.onseeked = () => {
      if (!seconds || !Number.isFinite(seconds)) return;
      const photo = grabStill(v);
      URL.revokeObjectURL(v.src);
      resolve({ seconds, photo });
    };
    v.onerror = () => reject(new Error("We couldn't read that video. Try a different file."));
  });
}

export function VideoCapture({ code, fields, resume = false }: { code: string; fields: FieldMeta[]; resume?: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(resume ? "processing" : "choose");
  const [step, setStep] = useState<Step>(resume ? "listen" : "upload");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  // Set when processing finishes: which fields the video filled in, revealed one tick at a time.
  const [result, setResult] = useState<{ filled: FieldKey[]; next: string } | null>(null);
  const [revealed, setRevealed] = useState(0);

  const clipRef = useRef<Clip | null>(null);
  const liveRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const photoRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => () => stopStream(), []);

  // Tick the checklist off field by field, then move on to the form.
  useEffect(() => {
    if (!result) return;
    if (revealed < fields.length) {
      const t = setTimeout(() => setRevealed((n) => n + 1), 220);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => router.push(result.next), 1800);
    return () => clearTimeout(t);
  }, [result, revealed, fields.length, router]);

  // Came back mid-processing (refresh, closed tab): pick up where the server left off.
  useEffect(() => {
    if (resume) void runProcessing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume]);

  function stopStream() {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function fail(message: string, keepClip = false) {
    if (!keepClip) clipRef.current = null;
    setError(message);
    setPhase(keepClip ? "failed" : "choose");
  }

  /** Length check shared by recordings and uploads. Returns an error message, or null if OK. */
  function checkLength(seconds: number): string | null {
    if (seconds < VIDEO_MIN_SECONDS - 0.5) return `That was ${Math.round(seconds)} seconds. Your intro needs to be at least ${VIDEO_MIN_SECONDS} seconds.`;
    if (seconds > VIDEO_MAX_SECONDS + 2) return `That video is ${fmt(seconds)} long. Your intro can be at most ${VIDEO_MAX_SECONDS} seconds.`;
    return null;
  }

  async function startRecording() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording isn't supported in this browser. Upload a video from your camera roll instead.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setError("We need camera and microphone access to record. Allow it in your browser settings, or upload a video instead.");
      return;
    }
    streamRef.current = stream;
    setPhase("recording");
    requestAnimationFrame(() => {
      if (liveRef.current) {
        liveRef.current.srcObject = stream;
        void liveRef.current.play();
      }
    });

    const mimeType = pickMime();
    const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 1_500_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const seconds = (Date.now() - startedAtRef.current) / 1000;
      stopStream();
      const tooShortOrLong = checkLength(seconds);
      if (tooShortOrLong) return fail(tooShortOrLong);
      const blob = new Blob(chunks, { type: (recorder.mimeType || mimeType || "video/webm").split(";")[0] });
      clipRef.current = { blob, seconds, photo: photoRef.current };
      void submit();
    };
    recorderRef.current = recorder;
    photoRef.current = null;
    startedAtRef.current = Date.now();
    setElapsed(0);
    recorder.start(1000);
    timerRef.current = setInterval(() => {
      const s = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(s);
      if (!photoRef.current && s > 2 && liveRef.current) photoRef.current = grabStill(liveRef.current);
      if (s >= VIDEO_MAX_SECONDS) stopRecording();
    }, 250);
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("video/")) return setError("Please choose a video file.");
    if (file.size > VIDEO_MAX_BYTES) return setError("That video file is too large. Try a shorter clip.");
    try {
      const { seconds, photo } = await inspectFile(file);
      const tooShortOrLong = checkLength(seconds);
      if (tooShortOrLong) return fail(tooShortOrLong);
      clipRef.current = { blob: file, seconds, photo };
      void submit();
    } catch (e) {
      fail((e as Error).message);
    }
  }

  /** Upload, then hand over to processing. Runs straight after recording stops or a file is picked. */
  async function submit() {
    const clip = clipRef.current;
    if (!clip) return;
    setError(null);
    setProgress(0);
    setStep("upload");
    setPhase("uploading");
    const res = await requestUpload(code, { contentType: clip.blob.type || "video/mp4", size: clip.blob.size, seconds: clip.seconds });
    if (!res.ok) return fail(res.error);
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(res.target.method, res.target.url);
        Object.entries(res.target.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(e.loaded / e.total);
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
        xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
        xhr.send(clip.blob);
      });
    } catch (e) {
      return fail((e as Error).message, true);
    }
    const done = await finishUpload(code, { photo: clip.photo });
    if (!done.ok) return fail(done.error, true);
    await runProcessing();
  }

  async function runProcessing() {
    setPhase("processing");
    setStep("listen");
    const started = Date.now();
    // The worker usually reports back within a minute (longer on a cold start). Poll until it does.
    for (;;) {
      try {
        const r = await checkProcessing(code);
        if (r.done) {
          setStep("done");
          setRevealed(0);
          return setResult({ filled: r.filled, next: r.next });
        }
      } catch {
        /* transient network error: keep polling */
      }
      if (Date.now() - started > 15_000) setStep("extract");
      await new Promise((res) => setTimeout(res, 2500));
    }
  }

  const busy = phase === "uploading" || phase === "processing";
  // After 90s of processing, offer a way out (results still fill the form if they arrive later).
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (phase !== "processing") return setSlow(false);
    const t = setTimeout(() => setSlow(true), 90_000);
    return () => clearTimeout(t);
  }, [phase]);
  const canStop = elapsed >= VIDEO_MIN_SECONDS;

  return (
    <div className="space-y-5">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-3xl bg-forest bg-candle text-cream shadow-lift">
        {phase === "recording" && (
          <>
            <video ref={liveRef} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
            <div className="absolute inset-x-0 top-0 h-1 bg-cream/20">
              <div className="h-full bg-sand transition-[width] duration-200" style={{ width: `${Math.min(100, (elapsed / VIDEO_MAX_SECONDS) * 100)}%` }} />
            </div>
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-forest-ink/70 px-3 py-1 text-sm font-semibold text-cream">
              <span className="h-2 w-2 animate-pulse rounded-full bg-tomato" /> {fmt(elapsed)} / {fmt(VIDEO_MAX_SECONDS)}
            </div>
            <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-forest-ink/70 p-3 backdrop-blur">
              <p className="mb-1.5 font-serif text-[10px] font-bold uppercase tracking-caps text-sand">Try to mention</p>
              <ul className="flex flex-wrap gap-1.5">
                {fields.map((f, i) => (
                  <li
                    key={f.key}
                    className={clsx(
                      "rounded-full px-2.5 py-1 text-xs transition",
                      elapsed > i * (VIDEO_MAX_SECONDS / fields.length / 1.5) ? "bg-cream text-forest" : "bg-cream/10 text-cream/60",
                    )}
                  >
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {(phase === "choose" || phase === "failed") && (
          <div className="flex h-full flex-col justify-center gap-3 overflow-y-auto p-6">
            <p className="font-display text-[30px] leading-[0.95] text-cream">Say hi in {VIDEO_MIN_SECONDS} to {VIDEO_MAX_SECONDS} seconds</p>
            <p className="text-sm text-cream/75">We fill in your profile from what you say. Try to mention:</p>
            <ul className="space-y-1 text-sm text-cream/90">
              {fields.map((f) => <li key={f.key} className="flex gap-2"><span className="text-sand">•</span>{f.clue}</li>)}
            </ul>
          </div>
        )}

        {busy && <ProcessingView step={step} progress={progress} fields={fields} filled={result?.filled ?? null} revealed={revealed} />}
      </div>

      {error && <p role="alert" className="mx-auto max-w-sm rounded-xl border border-tomato/40 bg-tomato/10 px-4 py-3 text-sm text-tomato">{error}</p>}

      <div className="mx-auto flex max-w-sm flex-col gap-2">
        {phase === "choose" && (
          <>
            <button className="btn-primary py-3.5 text-base" onClick={startRecording}><span className="h-2.5 w-2.5 rounded-full bg-tomato" /> Record now</button>
            <label className="btn-ghost cursor-pointer py-3.5 text-base">
              Upload a video
              <input type="file" accept="video/*" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </>
        )}
        {phase === "recording" && (
          <>
            <button className="btn-primary py-3.5 text-base" onClick={stopRecording}>■ Stop &amp; continue</button>
            <p className="text-center text-xs text-forest/55">
              {canStop ? "Stop whenever you're done." : `At least ${VIDEO_MIN_SECONDS} seconds needed (${Math.ceil(VIDEO_MIN_SECONDS - elapsed)}s to go).`}
            </p>
          </>
        )}
        {phase === "failed" && (
          <>
            <button className="btn-primary py-3.5 text-base" onClick={() => void submit()}>Try again</button>
            <button className="btn-ghost" onClick={() => { clipRef.current = null; setError(null); setPhase("choose"); }}>Record a new one</button>
          </>
        )}
        {busy && !result && (
          <p className="text-center text-xs text-forest/55">
            {slow
              ? "Taking longer than usual. Hang tight, or keep going and fill in your profile yourself."
              : "Keep this page open. This usually takes under a minute."}
          </p>
        )}
        {busy && !result && slow && (
          <button className="btn-ghost" onClick={() => void skipProcessing(code)}>Fill it in myself</button>
        )}
        {result && revealed >= fields.length && (
          <button className="btn-primary py-3.5 text-base" onClick={() => router.push(result.next)}>Continue</button>
        )}
      </div>
    </div>
  );
}

const STEPS: { key: Exclude<Step, "done">; label: string }[] = [
  { key: "upload", label: "Uploading" },
  { key: "listen", label: "Listening" },
  { key: "extract", label: "Reading details" },
];

function ProcessingView({
  step, progress, fields, filled, revealed,
}: { step: Step; progress: number; fields: FieldMeta[]; filled: FieldKey[] | null; revealed: number }) {
  const done = filled !== null;
  const current = done ? STEPS.length : STEPS.findIndex((s) => s.key === step);
  const filledCount = filled ? fields.filter((f) => filled.includes(f.key)).length : 0;
  return (
    <div className="absolute inset-0 flex flex-col gap-4 overflow-y-auto bg-forest bg-candle p-5 text-cream" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 shrink-0">
          <div className="absolute inset-0 rounded-full border-[3px] border-cream/15" />
          {done ? (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-cream text-lg text-forest">✓</span>
          ) : (
            <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-sand" />
          )}
        </div>
        <div>
          <p className="font-display text-xl leading-tight">{done ? "Your profile is ready" : "Processing your intro"}</p>
          <p className="text-xs text-cream/70">
            {!done && step === "upload" ? `Uploading ${Math.round(progress * 100)}%` : done ? `${filledCount} of ${fields.length} filled from your video` : "Hang tight, this takes a moment."}
          </p>
        </div>
      </div>

      <ol className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex-1">
            <div className={clsx("h-1 rounded-full", i < current ? "bg-sand" : i === current ? "animate-pulse bg-cream" : "bg-cream/15")} />
            <p className={clsx("mt-1 text-[11px]", i <= current ? "text-cream/80" : "text-cream/45")}>{s.label}</p>
          </li>
        ))}
      </ol>

      <ul className="space-y-1.5 text-sm">
        {fields.map((f, i) => {
          const shown = done && i < revealed;
          const ok = shown && filled!.includes(f.key);
          return (
            <li key={f.key} className="flex items-center gap-2.5">
              <span
                className={clsx(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold transition",
                  ok && "bg-sand text-forest",
                  shown && !ok && "bg-cream/10 text-cream/50",
                  !shown && "bg-cream/10",
                )}
              >
                {ok ? "✓" : shown ? "–" : <span className={clsx("h-1.5 w-1.5 rounded-full bg-cream/30", !done && "animate-pulse")} />}
              </span>
              <span className={clsx(ok ? "text-cream" : shown ? "text-cream/50" : "text-cream/75")}>{f.label}</span>
              {shown && !ok && <span className="ml-auto font-serif text-[11px] italic text-sand">add next</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
