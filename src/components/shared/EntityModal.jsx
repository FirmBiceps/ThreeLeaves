import { X } from 'lucide-react';

export function EntityModal({ title, onClose, onSave, children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm print:hidden">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b bg-gray-50 p-6 text-[10px] font-black uppercase tracking-widest text-gray-400">
          <span>{title}</span>
          <button onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <div className="p-8">{children}</div>
        <div className="flex justify-end space-x-2 border-t bg-gray-50 p-4">
          <button className="px-4 py-2 text-sm font-bold text-gray-400" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-blue-900/20"
            onClick={onSave}
            type="button"
          >
            Save Entry
          </button>
        </div>
      </div>
    </div>
  );
}
