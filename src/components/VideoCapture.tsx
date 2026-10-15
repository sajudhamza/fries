"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { finishUpload, processVideo, requestUpload } from "@/lib/join-actions";
import { VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, VIDEO_MIN_SECONDS } from "@/lib/types";

type Phase = "choose" | "recording" | "ready" | "uploading" | "processing";

interface Clip {
  blob: Blob;
  url: string;
  seconds: number;
  photo: string | null;
}

const PROMPTS = [
  "Your first name and age",
  "Your height",
  "What you do",
  "Hobbies & what you love doing",
  "What you're looking for tonight",
];

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

export function VideoCapture({ code, resume = false }: { code: string; resume?: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(resume ? "processing" : "choose");
  const [step, setStep] = useState<"listening" | "writing">("listening");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<Clip | null>(null);
  const [progress, setProgress] = useState(0);

  const liveRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const photoRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => () => stopStream(), []);

  // Came back mid-processing (refresh, closed tab): pick up where the server left off.
  useEffect(() => {
    if (resume) void runProcessing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume]);

  async function runProcessing() {
    setPhase("processing");
    setStep("listening");
    for (let i = 0; i < 6; i++) {
      try {
        const r = await processVideo(code);
        if (r.done) return router.push(r.next);
        setStep("writing");
      } catch {
        await new Promise((res) => setTimeout(res, 1500));
      }
    }
    router.refresh();
  }

  function stopStream() {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function reset() {
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(null);
    setError(null);
    setElapsed(0);
    setProgress(0);
    setPhase("choose");
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
      const blob = new Blob(chunks, { type: (recorder.mimeType || mimeType || "video/webm").split(";")[0] });
      setClip({ blob, url: URL.createObjectURL(blob), seconds, photo: photoRef.current });
      setPhase("ready");
    };
    recorderRef.current = recorder;
    photoRef.current = null;
    startedAtRef.current = Date.now();
    setElapsed(0);
    recorder.start(1000);
    timerRef.current = setInterval(() => {
      const s = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(s);
      if (!photoRef.current && s > 3 && liveRef.current) photoRef.current = grabStill(liveRef.current);
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
    if (file.size > VIDEO_MAX_BYTES) return setError("That video is over 300 MB. Try a shorter clip or lower quality.");
    try {
      const { seconds, photo } = await inspectFile(file);
      setClip({ blob: file, url: URL.createObjectURL(file), seconds, photo });
      setPhase("ready");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submit() {
    if (!clip) return;
    setError(null);
    setPhase("uploading");
    const res = await requestUpload(code, { contentType: clip.blob.type || "video/mp4", size: clip.blob.size, seconds: clip.seconds });
    if (!res.ok) {
      setError(res.error);
      setPhase("ready");
      return;
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(res.target.method, res.target.url);
        Object.entries(res.target.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(e.loaded / e.total);
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
        xhr.send(clip.blob);
      });
    } catch (e) {
      setError((e as Error).message);
      setPhase("ready");
      return;
    }
    const done = await finishUpload(code, { photo: clip.photo });
    if (!done.ok) {
      setError(done.error);
      setPhase("ready");
      return;
    }
    await runProcessing();
  }

  const tooShort = clip ? clip.seconds < VIDEO_MIN_SECONDS - 1 : false;
  const tooLong = clip ? clip.seconds > VIDEO_MAX_SECONDS + 5 : false;
  const remainingToMin = Math.max(0, VIDEO_MIN_SECONDS - elapsed);

  return (
    <div className="space-y-5">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-3xl bg-night-800">
        {phase === "recording" && (
          <>
            <video ref={liveRef} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" /> {fmt(elapsed)} / {fmt(VIDEO_MAX_SECONDS)}
            </div>
            <ul className="absolute inset-x-3 bottom-3 space-y-1 rounded-2xl bg-black/55 p-3 text-sm backdrop-blur">
              {PROMPTS.map((p, i) => (
                <li key={p} className={clsx("transition", elapsed > i * 12 ? "text-white" : "text-white/40")}>• {p}</li>
              ))}
            </ul>
          </>
        )}
        {(phase === "ready" || phase === "uploading" || phase === "processing") && clip && (
          <video src={clip.url} controls playsInline className="h-full w-full bg-black object-contain" />
        )}
        {phase === "choose" && (
          <div className="flex h-full flex-col justify-center gap-4 p-6">
            <p className="font-display text-2xl font-bold">Say hi in 1 to 5 minutes</p>
            <p className="text-sm text-haze-300">We&apos;ll build your profile from what you say, so try to mention:</p>
            <ul className="space-y-1.5 text-sm">
              {PROMPTS.map((p) => <li key={p} className="flex gap-2"><span className="text-rose-400">✓</span>{p}</li>)}
            </ul>
          </div>
        )}
        {(phase === "uploading" || phase === "processing") && (
          <div className="absolute inset-0 grid place-items-center bg-night-950/80 backdrop-blur-sm">
            <div className="w-2/3 text-center">
              <p className="font-semibold">{phase === "uploading" ? `Uploading ${Math.round(progress * 100)}%` : step === "listening" ? "Listening to your intro…" : "Writing your profile…"}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={clsx("h-full rounded-full bg-rose-500 transition-all", phase === "processing" && "w-full animate-pulse")} style={phase === "uploading" ? { width: `${progress * 100}%` } : undefined} />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>}

      <div className="mx-auto flex max-w-sm flex-col gap-2">
        {phase === "choose" && (
          <>
            <button className="btn-primary py-3.5 text-base" onClick={startRecording}>● Record now</button>
            <label className="btn-ghost cursor-pointer py-3.5 text-base">
              Upload a video
              <input type="file" accept="video/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </>
        )}
        {phase === "recording" && (
          <button className="btn-primary py-3.5 text-base" onClick={stopRecording} disabled={remainingToMin > 0}>
            {remainingToMin > 0 ? `Keep going… ${Math.ceil(remainingToMin)}s to go` : "■ Stop recording"}
          </button>
        )}
        {phase === "ready" && clip && (
          <>
            <p className="text-center text-sm text-haze-300">
              {fmt(clip.seconds)} long
              {tooShort && <span className="text-rose-300"> · needs to be at least 1 minute</span>}
              {tooLong && <span className="text-rose-300"> · needs to be 5 minutes or less</span>}
            </p>
            <button className="btn-primary py-3.5 text-base" onClick={submit} disabled={tooShort || tooLong}>Use this video</button>
            <button className="btn-ghost" onClick={reset}>Start over</button>
          </>
        )}
      </div>
    </div>
  );
}
