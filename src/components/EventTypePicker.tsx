import { EVENT_TYPES, type EventType } from "@/lib/types";

/** Radio cards for choosing a location's event type (works without JavaScript). */
export function EventTypePicker({ defaultValue }: { defaultValue?: EventType }) {
  return (
    <fieldset>
      <legend className="label">Event type</legend>
      <div className="grid gap-2">
        {(Object.keys(EVENT_TYPES) as EventType[]).map((t) => (
          <label
            key={t}
            className="flex cursor-pointer gap-3 rounded-xl border border-white/10 bg-night-800 p-3 transition hover:border-white/25 has-[:checked]:border-rose-400 has-[:checked]:bg-rose-500/10"
          >
            <input type="radio" name="eventType" value={t} defaultChecked={t === defaultValue} required className="mt-1 accent-rose-500" />
            <span>
              <span className="block text-sm font-semibold">{EVENT_TYPES[t].label}</span>
              <span className="block text-xs text-haze-300">{EVENT_TYPES[t].blurb}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
