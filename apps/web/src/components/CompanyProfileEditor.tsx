import { useState, useEffect } from 'react';
import { useCompanyProfile } from '../hooks/useCompanyProfile';

export function CompanyProfileEditor({ onClose }: { onClose: () => void }) {
  const { profile, loading, save } = useCompanyProfile();
  const [form, setForm] = useState({
    name: '',
    description: '',
    value_proposition: '',
    service_area: '',
    extra_context: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        description: profile.description,
        value_proposition: profile.value_proposition,
        service_area: profile.service_area,
        extra_context: profile.extra_context,
      });
    }
  }, [profile]);

  const onSave = async () => {
    setSaving(true);
    try {
      await save(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">Company Profile</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-5">
          Shared by every agent on the hub. Updates apply to the next run.
        </p>

        {loading ? (
          <div className="text-[var(--color-text-secondary)]">Loading...</div>
        ) : (
          <div className="space-y-6">
            <fieldset className="space-y-3 border border-[var(--color-border-subtle)] rounded-lg p-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)] px-2">
                Basics
              </legend>
              <Field
                label="Company name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                placeholder="NordLight Solar"
              />
              <Field
                label="One-line description"
                value={form.description}
                onChange={(v) => setForm({ ...form, description: v })}
                placeholder="Rooftop solar installations across Estonia"
                hint="What does the company do, in one sentence?"
              />
              <Field
                label="Service area"
                value={form.service_area}
                onChange={(v) => setForm({ ...form, service_area: v })}
                placeholder="Tallinn, Tartu, Parnu"
              />
            </fieldset>

            <fieldset className="space-y-3 border border-[var(--color-border-subtle)] rounded-lg p-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)] px-2">
                Positioning
              </legend>
              <Field
                label="Value proposition"
                value={form.value_proposition}
                onChange={(v) => setForm({ ...form, value_proposition: v })}
                placeholder="What you sell and why it matters"
                hint="Why should prospects pick you over alternatives?"
                multiline
              />
            </fieldset>

            <fieldset className="space-y-3 border border-[var(--color-border-subtle)] rounded-lg p-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)] px-2">
                Additional context
              </legend>
              <Field
                label="Free-form notes"
                value={form.extra_context}
                onChange={(v) => setForm({ ...form, extra_context: v })}
                placeholder="ICP details, tone preferences, competitive notes -- anything every agent should know"
                hint="This gets included in every agent's system prompt."
                multiline
                large
              />
            </fieldset>
          </div>
        )}

        <div className="flex gap-2 mt-6 pt-4 border-t border-[var(--color-border-subtle)]">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-2 rounded bg-[var(--color-primary-dark)] text-white font-semibold hover:bg-[var(--color-primary-bright)] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  multiline = false,
  large = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  large?: boolean;
}) {
  const inputClass = 'w-full px-3 py-2 text-sm rounded border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:border-[var(--color-primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-dark)]/20';
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
        {label}
      </label>
      {hint && (
        <p className="text-[11px] text-[var(--color-text-tertiary)] mb-1.5">{hint}</p>
      )}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={large ? 6 : 3}
          className={inputClass}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
    </div>
  );
}
