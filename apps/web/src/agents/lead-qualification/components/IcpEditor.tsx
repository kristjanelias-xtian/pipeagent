import { useState } from 'react';
import type { IcpCriterion } from '@pipeagent/shared';

export function IcpEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: IcpCriterion[];
  onSave: (criteria: IcpCriterion[]) => void | Promise<void>;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<IcpCriterion[]>(initial);

  const update = (i: number, patch: Partial<IcpCriterion>) => {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const remove = (i: number) => setRows(rows.filter((_, idx) => idx !== i));

  const add = () =>
    setRows([...rows, { name: '', description: '', weight: 10 }]);

  const total = rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
          Manage ICP criteria
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-5">
          Each criterion is scored 0-10 by the agent. Weights determine how much it contributes to
          the overall score.
        </p>

        <div className="grid grid-cols-[1.2fr_2fr_80px_32px] gap-3 text-xs uppercase tracking-wide font-semibold text-[var(--color-text-tertiary)] mb-2">
          <div>Name</div>
          <div>Description</div>
          <div className="text-center">Weight</div>
          <div />
        </div>

        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1.2fr_2fr_80px_32px] gap-3 items-center">
              <input
                value={row.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Criterion name"
                className="px-3 py-2 rounded border border-[var(--color-border-default)] focus:border-[var(--color-primary-dark)] focus:outline-none"
              />
              <input
                value={row.description}
                onChange={(e) => update(i, { description: e.target.value })}
                placeholder="Description"
                className="px-3 py-2 rounded border border-[var(--color-border-default)] focus:border-[var(--color-primary-dark)] focus:outline-none"
              />
              <input
                type="number"
                value={row.weight}
                onChange={(e) => update(i, { weight: Number(e.target.value) })}
                className="px-3 py-2 rounded border border-[var(--color-border-default)] text-center focus:border-[var(--color-primary-dark)] focus:outline-none"
              />
              <button
                onClick={() => remove(i)}
                className="text-[var(--color-text-tertiary)] hover:text-red-500 text-xl"
                aria-label="Remove criterion"
              >
                x
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={add}
          className="w-full mt-3 py-2 border border-dashed border-[var(--color-border-default)] rounded text-[var(--color-text-secondary)] text-sm hover:border-[var(--color-primary-dark)] hover:text-[var(--color-primary-dark)]"
        >
          + Add criterion
        </button>

        <div className="text-right text-xs text-[var(--color-text-tertiary)] mt-2">
          Total weight: {total}
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t border-[var(--color-border-subtle)]">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(rows)}
            className="flex-1 py-2 rounded bg-[var(--color-primary-dark)] text-white font-semibold hover:bg-[var(--color-primary-bright)]"
          >
            Save criteria
          </button>
        </div>
      </div>
    </div>
  );
}
