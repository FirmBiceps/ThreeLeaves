export function StatCard({ label, val, icon: Icon, color }) {
  const accents = { emerald: 'text-[#027a48]', blue: 'text-[#344054]', red: 'text-[#b42318]', indigo: 'text-[#344054]' };
  return (
    <div className="tl-metric-card flex items-start justify-between">
      <div className="min-w-0">
        <p className="tl-metric-card__label">{label}</p>
        <h4 className="tl-metric-card__value">{val}</h4>
      </div>
      {Icon && <div className={`tl-metric-card__icon mt-1 ${accents[color] || accents.blue}`}><Icon size={18} strokeWidth={1.8} /></div>}
    </div>
  );
}
