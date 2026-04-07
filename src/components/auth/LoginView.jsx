import { Lock } from 'lucide-react';

export function LoginView({ sys, loginError, setLoginError }) {
  const handleSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = form.get('username');
    const password = form.get('password');
    const user = sys.users.find((entry) => entry.username === username && entry.password === password);

    if (user) {
      sys.setCurrentUser(user);
      setLoginError('');
      return;
    }

    setLoginError('Login Failure: Access Forbidden');
  };

  return (
    <div className="flex h-screen items-center justify-center overflow-hidden bg-slate-950 p-6">
      <div className="relative w-full max-w-md overflow-hidden rounded-[64px] bg-white p-16 shadow-2xl">
        <div className="absolute left-0 top-0 h-3 w-full bg-gradient-to-r from-blue-500 to-indigo-600" />
        <div className="mb-12 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[32px] bg-blue-50 text-blue-600">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900">Gateway Access</h1>
          <p className="mt-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            Three Leaves Enterprise
          </p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {loginError && (
            <div className="animate-bounce rounded-3xl border border-red-100 bg-red-50 p-4 text-center text-[10px] font-black uppercase text-red-600">
              {loginError}
            </div>
          )}
          <input
            className="w-full rounded-3xl border-none bg-slate-50 p-5 font-bold focus:ring-2 focus:ring-blue-500"
            defaultValue="admin"
            name="username"
            placeholder="Username"
            required
          />
          <input
            className="w-full rounded-3xl border-none bg-slate-50 p-5 font-bold focus:ring-2 focus:ring-blue-500"
            defaultValue="admin123"
            name="password"
            placeholder="Password"
            required
            type="password"
          />
          <button className="mt-6 w-full rounded-3xl bg-slate-900 py-5 text-xs font-black uppercase text-white shadow-xl shadow-slate-900/40 transition-all hover:bg-slate-800">
            Authorize Identity
          </button>
        </form>
      </div>
    </div>
  );
}
