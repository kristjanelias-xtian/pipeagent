import { useState, useEffect } from 'react';
import type { IcpCriterion } from '@pipeagent/shared';

// Local type for the legacy /settings endpoint (will be replaced when server migrates to company_profile + agent_identity)
export interface BusinessProfile {
  business_description: string;
  value_proposition: string;
  icp_criteria: IcpCriterion[];
  outreach_tone: string;
  followup_days: number;
}

interface SettingsPanelProps {
  settings: BusinessProfile | null;
  saving: boolean;
  onSave: (settings: BusinessProfile) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, saving, onSave, onClose }: SettingsPanelProps) {
  const [form, setForm] = useState<BusinessProfile>({
    business_description: '',
    value_proposition: '',
    icp_criteria: [],
    outreach_tone: '',
    followup_days: 3,
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const updateField = (field: keyof BusinessProfile, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateCriterion = (index: number, field: keyof IcpCriterion, value: string | number) => {
    setForm((prev) => {
      const criteria = [...prev.icp_criteria];
      criteria[index] = { ...criteria[index], [field]: value };
      return { ...prev, icp_criteria: criteria };
    });
  };

  const addCriterion = () => {
    setForm((prev) => ({
      ...prev,
      icp_criteria: [...prev.icp_criteria, { name: '', description: '', weight: 10 }],
    }));
  };

  const removeCriterion = (index: number) => {
    setForm((prev) => ({
      ...prev,
      icp_criteria: prev.icp_criteria.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div className="p-4 space-y-5">
          {/* Business Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Business Description</label>
            <textarea
              value={form.business_description}
              onChange={(e) => updateField('business_description', e.target.value)}
              rows={3}
              placeholder="What does your company do?"
              className="w-full bg-gray-800 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Value Proposition */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Value Proposition</label>
            <textarea
              value={form.value_proposition}
              onChange={(e) => updateField('value_proposition', e.target.value)}
              rows={3}
              placeholder="What value do you provide to customers?"
              className="w-full bg-gray-800 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Outreach Tone */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Outreach Tone</label>
            <textarea
              value={form.outreach_tone}
              onChange={(e) => updateField('outreach_tone', e.target.value)}
              rows={2}
              placeholder="e.g. Professional but friendly, consultative..."
              className="w-full bg-gray-800 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Follow-up Days */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Follow-up Days</label>
            <input
              type="number"
              value={form.followup_days}
              onChange={(e) => setForm((prev) => ({ ...prev, followup_days: Number(e.target.value) }))}
              min={1}
              max={30}
              className="w-24 bg-gray-800 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">Days until follow-up activity is scheduled after sending an email</p>
          </div>

          {/* ICP Criteria */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">ICP Criteria</label>
              <button
                onClick={addCriterion}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                + Add Criterion
              </button>
            </div>
            <div className="space-y-3">
              {form.icp_criteria.map((criterion, i) => (
                <div key={i} className="bg-gray-800 rounded p-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={criterion.name}
                      onChange={(e) => updateCriterion(i, 'name', e.target.value)}
                      placeholder="Criterion name"
                      className="flex-1 bg-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <input
                      type="number"
                      value={criterion.weight}
                      onChange={(e) => updateCriterion(i, 'weight', Number(e.target.value))}
                      min={1}
                      max={100}
                      className="w-20 bg-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => removeCriterion(i)}
                      className="text-red-400 hover:text-red-300 text-sm px-2"
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    value={criterion.description}
                    onChange={(e) => updateCriterion(i, 'description', e.target.value)}
                    placeholder="Description (used in scoring prompt)"
                    className="w-full bg-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              ))}
              {form.icp_criteria.length === 0 && (
                <p className="text-sm text-gray-500">No criteria. Default criteria will be used.</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 rounded text-sm font-medium transition"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
