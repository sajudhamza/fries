import { GENDERS, INTERESTS, type Gender, type Interest } from "@/lib/types";

function Choice({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="flex-1 cursor-pointer">
      <input type="radio" name={name} value={value} defaultChecked={checked} required className="peer sr-only" />
      <span className="block rounded-xl border border-white/10 bg-night-800 px-3 py-2.5 text-center text-sm transition peer-checked:border-rose-400 peer-checked:bg-rose-500/15 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-rose-400">
        {label}
      </span>
    </label>
  );
}

/** Matchmaking events only: who you are and who you'd like to see. Both required. */
export function MatchPrefs({ gender, interestedIn }: { gender: Gender | ""; interestedIn: Interest | "" }) {
  return (
    <section className="card space-y-4 p-4">
      <div>
        <p className="font-semibold">This is a matchmaking event</p>
        <p className="text-sm text-haze-300">You&apos;ll see people you&apos;re interested in who are also interested in you.</p>
      </div>
      <fieldset>
        <legend className="label">I am a</legend>
        <div className="flex gap-2">
          {(Object.keys(GENDERS) as Gender[]).map((g) => (
            <Choice key={g} name="gender" value={g} label={GENDERS[g]} checked={gender === g} />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Show me</legend>
        <div className="flex gap-2">
          {(Object.keys(INTERESTS) as Interest[]).map((i) => (
            <Choice key={i} name="interestedIn" value={i} label={INTERESTS[i]} checked={interestedIn === i} />
          ))}
        </div>
      </fieldset>
    </section>
  );
}
