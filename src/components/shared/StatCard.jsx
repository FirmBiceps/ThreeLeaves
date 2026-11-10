export function StatCard({ label, val, icon: Icon, color }) {
  const accents = {
    emerald: 'text-emerald-700',
    blue: 'text-slate-700',
    red: 'text-red-700',
    indigo: 'text-slate-700',
  };

  return (
    <div className="tl-surface flex min-h-[112px] items-start justify-between p-4">
      <div className="min-w-0">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {label}
        </p>
        <h4 className="text-[24px] font-semibold tracking-[-0.025em] text-slate-900">
          {val}
        </h4>
      </div>
      {Icon && (
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center ${accents[color] || accents.blue}`}>
          <Icon size={18} strokeWidth={1.8} />
        </div>
      )}
    </div>
  );
}
