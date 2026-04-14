import { useMemo, useState } from 'react';

const diseaseSuggestions = [
  "Parkinson's Disease",
  'Lung Cancer',
  'Type 2 Diabetes',
  "Alzheimer's Disease",
  'Heart Disease',
  'Breast Cancer',
  'Multiple Sclerosis',
  'Rheumatoid Arthritis'
];

const sexOptions = ['Male', 'Female', 'Other'];

export default function ContextForm({ onSubmit, onClose }) {
  const [form, setForm] = useState({
    disease: '',
    intent: '',
    city: '',
    country: '',
    age: '',
    sex: ''
  });

  const canSubmit = useMemo(() => form.disease.trim().length > 0, [form.disease]);

  const update = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const submit = (event) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    onSubmit({
      disease: form.disease.trim(),
      intent: form.intent.trim(),
      location: {
        city: form.city.trim(),
        country: form.country.trim()
      },
      demographics: {
        age: form.age ? Number(form.age) : null,
        sex: form.sex || null
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Start a Research Session</h2>
            <p className="mt-1 text-sm text-slate-400">Provide context so retrieval and trial matching are personalized.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
          >
            Close
          </button>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Disease / Condition *</label>
            <input
              value={form.disease}
              onChange={(event) => update('disease', event.target.value)}
              placeholder="e.g. Parkinson's Disease"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
              required
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {diseaseSuggestions.slice(0, 4).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => update('disease', suggestion)}
                  className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">What do you want to know?</label>
            <input
              value={form.intent}
              onChange={(event) => update('intent', event.target.value)}
              placeholder="e.g. Deep brain stimulation outcomes"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-300">City</label>
              <input
                value={form.city}
                onChange={(event) => update('city', event.target.value)}
                placeholder="Toronto"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Country</label>
              <input
                value={form.country}
                onChange={(event) => update('country', event.target.value)}
                placeholder="Canada"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Age (optional)</label>
              <input
                type="number"
                min="0"
                max="120"
                value={form.age}
                onChange={(event) => update('age', event.target.value)}
                placeholder="45"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Sex (optional)</label>
              <select
                value={form.sex}
                onChange={(event) => update('sex', event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
              >
                <option value="">Prefer not to say</option>
                {sexOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Begin Research
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
