import { useState } from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { EntityModal } from '../../components/shared/EntityModal';
import { AVAILABLE_PERMISSIONS } from '../../data/company';

function TeamMemberModal({ initialValue, onClose, onSave }) {
  const [form, setForm] = useState(initialValue);

  const togglePermission = (permissionId) => {
    const currentPermissions = form.permissions || [];
    setForm({
      ...form,
      permissions: currentPermissions.includes(permissionId)
        ? currentPermissions.filter((entry) => entry !== permissionId)
        : [...currentPermissions, permissionId],
    });
  };

  return (
    <EntityModal onClose={onClose} onSave={() => onSave(form)} title="Privilege Configuration">
      <div className="space-y-4">
        <div>
          <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
            Full Name
          </label>
          <input
            className="mt-1 w-full rounded-xl border p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            value={form.name}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              Username
            </label>
            <input
              className="mt-1 w-full rounded-xl border p-2.5 font-mono outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              value={form.username}
            />
          </div>
          <div>
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              Password
            </label>
            <input
              className="mt-1 w-full rounded-xl border p-2.5 font-mono outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              value={form.password}
            />
          </div>
        </div>
        <div>
          <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
            Role
          </label>
          <select
            className="mt-1 w-full rounded-xl border p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
            value={form.role}
          >
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {form.role !== 'admin' && (
          <div className="mt-4 border-t pt-2">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
              Grants
            </p>
            <div className="space-y-2">
              {AVAILABLE_PERMISSIONS.map((permission) => (
                <label
                  className="flex cursor-pointer items-center space-x-3 rounded-xl p-2 transition-colors hover:bg-blue-50"
                  key={permission.id}
                >
                  <input
                    checked={form.permissions?.includes(permission.id) || false}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    onChange={() => togglePermission(permission.id)}
                    type="checkbox"
                  />
                  <span className="text-sm font-bold text-gray-700">{permission.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </EntityModal>
  );
}

export function TeamModule({ sys }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between rounded-t-xl border-b border-gray-100 bg-gray-50 p-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Team Access Control
        </h3>
        <button
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-black text-white shadow-md"
          onClick={() => {
            setEditingMember({
              username: '',
              password: '',
              name: '',
              role: 'employee',
              permissions: [],
            });
            setIsOpen(true);
          }}
          type="button"
        >
          Add Staff Member
        </button>
      </div>

      <table className="w-full text-left font-medium">
        <thead className="border-b bg-gray-50 text-[10px] font-black uppercase text-gray-400">
          <tr>
            <th className="p-4">Name</th>
            <th className="p-4">Username</th>
            <th className="p-4">Role</th>
            <th className="p-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-sm">
          {sys.users.map((user) => (
            <tr className="font-bold text-gray-900 hover:bg-gray-50" key={user.id}>
              <td className="p-4">{user.name}</td>
              <td className="p-4 font-mono text-gray-500">{user.username}</td>
              <td className="p-4 capitalize">
                <span
                  className={`rounded-lg border px-2 py-0.5 text-[9px] font-black tracking-widest ${
                    user.role === 'admin'
                      ? 'border-amber-200 bg-amber-100 text-amber-700'
                      : 'border-slate-200 bg-slate-100 text-slate-600'
                  }`}
                >
                  {user.role.toUpperCase()}
                </span>
              </td>
              <td className="p-4 text-right">
                <button
                  className="mr-2 rounded-xl p-2 text-blue-500 transition-colors hover:bg-blue-50"
                  onClick={() => {
                    setEditingMember({ ...user });
                    setIsOpen(true);
                  }}
                  type="button"
                >
                  <Edit size={18} />
                </button>
                {user.id !== sys.currentUser?.id && (
                  <button
                    className="rounded-xl p-2 text-red-200 transition-colors hover:text-red-600"
                    onClick={() => sys.setUsers(sys.users.filter((entry) => entry.id !== user.id))}
                    type="button"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isOpen && editingMember && (
        <TeamMemberModal
          initialValue={editingMember}
          onClose={() => setIsOpen(false)}
          onSave={(member) => {
            if (member.id) {
              sys.setUsers(sys.users.map((entry) => (entry.id === member.id ? member : entry)));
            } else {
              sys.setUsers([...sys.users, { ...member, id: `u${Date.now()}` }]);
            }
            setIsOpen(false);
          }}
        />
      )}
    </div>
  );
}
