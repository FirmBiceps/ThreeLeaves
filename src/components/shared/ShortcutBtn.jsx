export function ShortcutBtn({ icon: Icon, label, onClick, perm, sys }) {
  if (perm && !sys.hasPerm(perm)) {
    return null;
  }

  return (
    <button
      className="flex w-32 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-100 p-6 transition-all hover:border-blue-500 hover:bg-blue-50"
      onClick={onClick}
      type="button"
    >
      <Icon className="mb-2 text-blue-500" size={24} />
      <span className="text-[10px] font-black uppercase tracking-tighter text-gray-700">{label}</span>
    </button>
  );
}
