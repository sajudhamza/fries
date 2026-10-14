/**
 * Video → profile extraction seam.
 *
 * The planned pipeline: pull the audio track → speech-to-text → an LLM reads the transcript (plus a
 * few frames) and returns the ProfileFields it is confident about. Anything the person did not say
 * stays blank; we never guess sensitive traits from appearance.
 *
 * Until that provider is wired in, the manual extractor returns nothing and the attendee fills the
 * review form themselves. Swap the provider here; nothing else in the app needs to change.
 */
import type { ProfileFields } from "./types";

export interface ExtractInput {
  videoKey: string;
  /** Local path or authenticated storage URL from VideoStorage.locate(). */
  source: string;
  seconds: number | null;
}

export interface VideoExtractor {
  readonly name: string;
  extract(input: ExtractInput): Promise<Partial<ProfileFields>>;
}

const manualExtractor: VideoExtractor = {
  name: "manual",
  async extract() {
    return {};
  },
};

export function extractor(): VideoExtractor {
  return manualExtractor;
}
