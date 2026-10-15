/**
 * A Location is one QR bucket: a venue or event. Attendees who join through its QR code can only
 * ever see other attendees of that same location. When the event ends every profile and video in
 * the bucket is deleted; the location itself stays so the venue can be reopened for the next event.
 */
export type EventType = "business" | "matchmaking" | "social";

export const EVENT_TYPES: Record<EventType, { label: string; blurb: string }> = {
  social: { label: "Social", blurb: "Everyone at the event can see every profile." },
  business: { label: "Business", blurb: "Networking. Everyone can see every profile, no dating preferences asked." },
  matchmaking: { label: "Matchmaking", blurb: "Guests say who they're interested in and only see matching profiles." },
};

export interface Location {
  id: string;
  /** Unguessable public code embedded in the QR URL (/l/<code>). */
  code: string;
  name: string;
  venue: string;
  /** Decides who sees whom. Locations created before event types existed are "social". */
  eventType: EventType;
  startsAt: string | null;
  endsAt: string;
  /** Set when the event was closed and its data purged. Null = open. */
  endedAt: string | null;
  createdAt: string;
}

export type ProfileStatus =
  | "awaiting_video" // joined (consented) but no video uploaded yet
  | "processing" //     video uploaded, extraction running
  | "review" //         extraction done, attendee checks the details
  | "live"; //          visible to others in the same location

export interface ProfileFields {
  name: string;
  age: number | null;
  height: string;
  pronouns: string;
  occupation: string;
  bio: string;
  hobbies: string[];
  lookingFor: string;
  /** Matchmaking events only: the guest's own gender and who they want to see. */
  gender: Gender | "";
  interestedIn: Interest | "";
}

export type Gender = "man" | "woman" | "nonbinary";
export type Interest = "men" | "women" | "everyone";

export const GENDERS: Record<Gender, string> = { man: "Man", woman: "Woman", nonbinary: "Non-binary" };
export const INTERESTS: Record<Interest, string> = { men: "Men", women: "Women", everyone: "Everyone" };

export interface Profile {
  id: string;
  locationId: string;
  status: ProfileStatus;
  fields: ProfileFields;
  /** Fields that were filled from the video (shown as "from your video" on review). */
  extracted: (keyof ProfileFields)[];
  /** Small JPEG data URL grabbed from the intro video in the browser. */
  photo: string | null;
  videoKey: string | null;
  videoSeconds: number | null;
  /** Speech-to-text of the intro video. Null until transcribed; deleted with the profile. */
  transcript: string | null;
  consentAt: string;
  createdAt: string;
  updatedAt: string;
}

export const EMPTY_FIELDS: ProfileFields = {
  name: "",
  age: null,
  height: "",
  pronouns: "",
  occupation: "",
  bio: "",
  hobbies: [],
  lookingFor: "",
  gender: "",
  interestedIn: "",
};

export const VIDEO_MIN_SECONDS = 15;
export const VIDEO_MAX_SECONDS = 60;
export const VIDEO_MAX_BYTES = 300 * 1024 * 1024;
