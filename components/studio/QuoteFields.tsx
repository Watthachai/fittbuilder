"use client";

/**
 * The quotation panel's shared form primitives.
 *
 * They live in their own file rather than in Quotation.tsx because the payment,
 * maintenance and letterhead blocks are separate components that all need them —
 * importing back from Quotation.tsx would make the cycle Quotation → QuoteTerms
 * → Quotation, which bundles but is a trap for whoever edits it next.
 */

export const inputCls =
  "w-full rounded-lg border border-night-edge bg-night px-2.5 py-1.5 text-[12px] text-chalk outline-none focus:border-shine/60 disabled:opacity-50";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-display text-[10px] uppercase tracking-widest text-chalk-dim">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-0.5 text-[12px]">
      <span className="text-chalk-dim">{label}</span>
      <span className="font-mono text-chalk">{value}</span>
    </div>
  );
}

/** A section header with a switch — every optional block on the paper has one. */
export function SectionToggle({
  title,
  hint,
  on,
  onChange,
  disabled,
}: {
  title: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`mt-0.5 h-[18px] w-8 shrink-0 rounded-full p-0.5 transition disabled:opacity-40 ${
          on ? "bg-shine" : "bg-night-edge"
        }`}
      >
        <span
          className={`block h-[14px] w-[14px] rounded-full bg-chalk transition-transform ${
            on ? "translate-x-[14px]" : ""
          }`}
        />
      </button>
      <div className="min-w-0">
        <h3 className="font-display text-[12px] text-chalk">{title}</h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-chalk-dim">{hint}</p>
      </div>
    </div>
  );
}
