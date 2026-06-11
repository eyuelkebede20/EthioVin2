export type SpecDraft = Record<string, Record<string, string | number>>;

const humanize = (s: string) =>
  s
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());

/** Generic editor for a hardware_specs blob (sections of primitive fields). */
export default function SpecEditor({ specs, onChange }: { specs: SpecDraft; onChange: (next: SpecDraft) => void }) {
  const update = (section: string, field: string, value: string | number) =>
    onChange({ ...specs, [section]: { ...(specs[section] ?? {}), [field]: value } });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {Object.entries(specs).map(([section, fields]) =>
        fields && typeof fields === "object" ? (
          <div key={section} className="p-4 border border-orange-100 rounded-xl bg-base-200/50">
            <h4 className="font-bold text-slate-700 mb-3">{humanize(section)}</h4>
            <div className="flex flex-col gap-2">
              {Object.entries(fields).map(([field, value]) => (
                <label key={field} className="text-xs font-bold text-slate-500">
                  {humanize(field)}
                  <input
                    type={typeof value === "number" ? "number" : "text"}
                    value={value ?? ""}
                    onChange={(e) => update(section, field, typeof value === "number" ? (e.target.value === "" ? 0 : Number(e.target.value)) : e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}
