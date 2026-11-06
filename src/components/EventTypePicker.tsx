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
            className="flex cursor-pointer gap-3 rounded-xl border border-forest/10 bg-cream-light p-3 transition hover:border-forest/25 has-[:checked]:border-forest has-[:checked]:bg-forest/10"
          >
            <input type="radio" name="eventType" value={t} defaultChecked={t === defaultValue} required className="mt-1 accent-forest" />
            <span>
              <span className="block font-display text-lg leading-tight">{EVENT_TYPES[t].label}</span>
              <span className="block text-xs text-forest/70">{EVENT_TYPES[t].blurb}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
