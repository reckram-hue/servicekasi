'use client';

export function TechnicianPicker({
  technicians,
  selected,
  onChange,
}: {
  technicians: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (technicians.length === 0) {
    return <p className="mb-3 text-sm text-slate-500">Add a technician on the Team page before scheduling a visit.</p>;
  }

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div className="mb-3">
      <span className="mb-1 block text-sm text-slate-300">Technician(s)</span>
      <div className="flex flex-wrap gap-2">
        {technicians.map((t) => (
          <label
            key={t.id}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              selected.includes(t.id) ? 'border-amber-400 bg-amber-500/10 text-amber-300' : 'border-slate-700 text-slate-300'
            }`}
          >
            <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} className="h-4 w-4 rounded" />
            {t.name}
          </label>
        ))}
      </div>
    </div>
  );
}
