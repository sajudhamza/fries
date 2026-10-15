/**
 * Dispatches intro videos to the self-hosted profile worker (worker/ in this repo: faster-whisper +
 * a local Qwen model). The worker runs separately because the models need minutes of CPU and GBs of
 * memory, far beyond what the web tier allows. It reports back to /api/worker/result.
 *
 *  - Production: an AWS Lambda container function, invoked asynchronously (WORKER_LAMBDA_FUNCTION).
 *  - Development: the same image run locally with Docker (WORKER_URL = its invocation URL).
 *  - Neither set: no automatic extraction; guests fill the review form by hand.
 */
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { sign } from "./session";
import { videoStorage } from "./video-storage";
import { appUrl } from "./urls";
import type { Location, Profile } from "./types";

export type WorkerMode = "lambda" | "url" | "off";

export function workerMode(): WorkerMode {
  if (process.env.WORKER_LAMBDA_FUNCTION?.trim()) return "lambda";
  if (process.env.WORKER_URL?.trim()) return "url";
  return "off";
}

/** How long the app waits for the worker before letting the guest fill the form by hand. */
export const WORKER_TIMEOUT_MS = 8 * 60_000;

export function jobToken(profileId: string, videoKey: string): string {
  return sign(`worker:${profileId}:${videoKey}`);
}

/** Base URL the worker uses to reach this app (in local Docker dev: http://host.docker.internal:<port>). */
function callbackBase(): string {
  return (process.env.WORKER_APP_URL?.trim() || appUrl()).replace(/\/$/, "");
}

export function lambdaClient(): LambdaClient {
  const region = process.env.WORKER_AWS_REGION?.trim() || process.env.AWS_REGION || "us-east-1";
  const accessKeyId = process.env.WORKER_AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.WORKER_AWS_SECRET_ACCESS_KEY?.trim();
  // Prefer the Amplify compute role (default credential chain); explicit keys are the fallback.
  return new LambdaClient({ region, ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}) });
}

export async function dispatchProfileJob(profile: Profile, loc: Location): Promise<boolean> {
  const mode = workerMode();
  if (mode === "off" || !profile.videoKey) return false;
  const base = callbackBase();
  const job = {
    profileId: profile.id,
    token: jobToken(profile.id, profile.videoKey),
    videoUrl: await videoStorage().readUrl(profile.videoKey, base),
    callbackUrl: `${base}/api/worker/result`,
    // Whisper uses this as context; helps it spell the venue/event right.
    prompt: `A guest at ${loc.name} introduces themselves.`,
  };

  if (mode === "lambda") {
    await lambdaClient().send(
      new InvokeCommand({
        FunctionName: process.env.WORKER_LAMBDA_FUNCTION!.trim(),
        InvocationType: "Event", // async: returns immediately, Lambda runs the job and retries on crash
        Payload: Buffer.from(JSON.stringify(job)),
      }),
    );
    return true;
  }

  // Local Docker (Lambda runtime emulator) blocks until the job finishes, so don't await it.
  void fetch(process.env.WORKER_URL!.trim(), { method: "POST", body: JSON.stringify(job) }).catch((e) =>
    console.error("[worker] local dispatch failed:", e),
  );
  return true;
}
