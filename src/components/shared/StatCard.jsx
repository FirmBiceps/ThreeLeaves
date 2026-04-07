export function StatCard({ label, val, icon: Icon, color }) {
  const colors = {
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-600',
    blue: 'border-blue-100 bg-blue-50 text-blue-600',
    red: 'border-red-100 bg-red-50 text-red-600',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-600',
  };

  return (
    <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div>
        <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
        <h4 className="text-3xl font-black tracking-tighter text-gray-900">{val}</h4>
      </div>
      <div className={`rounded-2xl p-4 ${colors[color]}`}>
        <Icon size={24} />
      </div>
    </div>
  );
}
