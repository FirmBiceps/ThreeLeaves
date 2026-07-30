import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const INTERNAL_LOGIN_DOMAIN =
  import.meta.env.VITE_INTERNAL_LOGIN_DOMAIN || 'erp.threeleaves.com';

const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

const REMEMBERED_USERNAME_KEY =
  'three-leaves-remembered-username';

const LOGIN_ATTEMPTS_KEY =
  'three-leaves-login-attempts';

const LOGIN_LOCKED_UNTIL_KEY =
  'three-leaves-login-locked-until';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function usernameToEmail(username) {
  return `${normalizeUsername(username)}@${INTERNAL_LOGIN_DOMAIN}`;
}

function readStoredNumber(key) {
  try {
    const value = Number(
      window.sessionStorage.getItem(key)
    );

    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function LoginView({
  sys,
  loginError,
  setLoginError,
}) {
  const usernameInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [rememberUsername, setRememberUsername] =
    useState(true);

  const [capsLockOn, setCapsLockOn] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [failedAttempts, setFailedAttempts] =
    useState(0);

  const [lockedUntil, setLockedUntil] =
    useState(0);

  const [now, setNow] = useState(Date.now());

  const remainingLockSeconds = Math.max(
    0,
    Math.ceil((lockedUntil - now) / 1000)
  );

  const isLocked = remainingLockSeconds > 0;

  useEffect(() => {
    try {
      const rememberedUsername =
        window.localStorage.getItem(
          REMEMBERED_USERNAME_KEY
        ) || '';

      const storedAttempts =
        readStoredNumber(LOGIN_ATTEMPTS_KEY);

      const storedLockedUntil =
        readStoredNumber(
          LOGIN_LOCKED_UNTIL_KEY
        );

      setUsername(rememberedUsername);
      setRememberUsername(
        Boolean(rememberedUsername)
      );

      setFailedAttempts(storedAttempts);
      setLockedUntil(storedLockedUntil);

      window.requestAnimationFrame(() => {
        if (rememberedUsername) {
          passwordInputRef.current?.focus();
        } else {
          usernameInputRef.current?.focus();
        }
      });
    } catch {
      usernameInputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!isLocked) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isLocked]);

  useEffect(() => {
    if (
      lockedUntil > 0 &&
      lockedUntil <= now
    ) {
      setLockedUntil(0);
      setFailedAttempts(0);

      try {
        window.sessionStorage.removeItem(
          LOGIN_ATTEMPTS_KEY
        );

        window.sessionStorage.removeItem(
          LOGIN_LOCKED_UNTIL_KEY
        );
      } catch {
        // Storage may be unavailable.
      }
    }
  }, [lockedUntil, now]);

  const updateError = (message) => {
    if (
      typeof setLoginError === 'function'
    ) {
      setLoginError(message);
    }
  };

  const clearError = () => {
    if (loginError) {
      updateError('');
    }
  };

  const handleCapsLock = (event) => {
    setCapsLockOn(
      Boolean(
        event.getModifierState?.('CapsLock')
      )
    );
  };

  const registerFailedAttempt = () => {
    const nextAttempts =
      failedAttempts + 1;

    if (
      nextAttempts >= MAX_FAILED_ATTEMPTS
    ) {
      const nextLockedUntil =
        Date.now() +
        LOCKOUT_SECONDS * 1000;

      setFailedAttempts(nextAttempts);
      setLockedUntil(nextLockedUntil);
      setNow(Date.now());

      try {
        window.sessionStorage.setItem(
          LOGIN_ATTEMPTS_KEY,
          String(nextAttempts)
        );

        window.sessionStorage.setItem(
          LOGIN_LOCKED_UNTIL_KEY,
          String(nextLockedUntil)
        );
      } catch {
        // Continue even when storage is unavailable.
      }

      updateError(
        `Too many unsuccessful attempts. Try again in ${LOCKOUT_SECONDS} seconds.`
      );

      return;
    }

    setFailedAttempts(nextAttempts);

    try {
      window.sessionStorage.setItem(
        LOGIN_ATTEMPTS_KEY,
        String(nextAttempts)
      );
    } catch {
      // Continue even when storage is unavailable.
    }

    const attemptsRemaining =
      MAX_FAILED_ATTEMPTS -
      nextAttempts;

    updateError(
      `The username or password is incorrect. ${attemptsRemaining} attempt${
        attemptsRemaining === 1 ? '' : 's'
      } remaining.`
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting || isLocked) {
      return;
    }

    const normalizedUsername =
      normalizeUsername(username);

    if (
      !normalizedUsername ||
      !password
    ) {
      updateError(
        'Enter both your username and password.'
      );

      return;
    }

    if (
      !USERNAME_PATTERN.test(
        normalizedUsername
      )
    ) {
      updateError(
        'Username may contain only letters, numbers, dots, underscores, and hyphens.'
      );

      return;
    }

    if (
      typeof sys?.setCurrentUser !==
      'function'
    ) {
      updateError(
        'Login is unavailable because the session handler is missing.'
      );

      return;
    }

    setIsSubmitting(true);
    clearError();

    try {
      const internalEmail =
        usernameToEmail(
          normalizedUsername
        );

      console.info('Attempting Supabase login as:', internalEmail);

      const {
        data: authData,
        error: authError,
      } =
        await supabase.auth.signInWithPassword(
          {
            email: internalEmail,
            password,
          }
        );

      if (authError || !authData?.user) {
        console.error('Supabase authentication error:', authError);

        updateError(
          `Authentication failed: ${
            authError?.message ||
            'No authenticated user was returned.'
          }`
        );

        setPassword('');

        window.requestAnimationFrame(() => {
          passwordInputRef.current?.focus();
        });

        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('user_profiles')
        .select(
          [
            'id',
            'username',
            'name',
            'role',
            'permissions',
            'is_active',
          ].join(', ')
        )
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        console.error('User profile error:', profileError);

        await supabase.auth.signOut();

        updateError(
          `Authentication succeeded, but profile loading failed: ${
            profileError?.message ||
            'No matching profile was found.'
          }`
        );

        return;
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();

        throw new Error(
          'This account has been disabled. Contact the system administrator.'
        );
      }

      if (
        normalizeUsername(
          profile.username
        ) !== normalizedUsername
      ) {
        await supabase.auth.signOut();

        throw new Error(
          'The account details could not be verified.'
        );
      }

      try {
        if (rememberUsername) {
          window.localStorage.setItem(
            REMEMBERED_USERNAME_KEY,
            normalizedUsername
          );
        } else {
          window.localStorage.removeItem(
            REMEMBERED_USERNAME_KEY
          );
        }

        window.sessionStorage.removeItem(
          LOGIN_ATTEMPTS_KEY
        );

        window.sessionStorage.removeItem(
          LOGIN_LOCKED_UNTIL_KEY
        );
      } catch {
        // Login still works when storage is unavailable.
      }

      setFailedAttempts(0);
      setLockedUntil(0);
      setPassword('');
      updateError('');

      sys.setCurrentUser({
        ...profile,

        username:
          normalizedUsername,

        permissions:
          Array.isArray(
            profile.permissions
          )
            ? profile.permissions
            : [],

        authUser:
          authData.user,
      });
    } catch (error) {
      console.error(
        'Login error:',
        error
      );

      const safeMessages =
        new Set([
          'Your account profile is not configured. Contact the system administrator.',
          'This account has been disabled. Contact the system administrator.',
          'The account details could not be verified.',
        ]);

      updateError(
        safeMessages.has(
          error?.message
        )
          ? error.message
          : 'Login could not be completed. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />

        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_42%)]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[32px] border border-white/10 bg-white shadow-2xl shadow-black/40 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative hidden min-h-[680px] overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="pointer-events-none absolute inset-0 opacity-40">
              <div className="absolute right-8 top-16 h-40 w-40 rounded-full border border-white/10" />

              <div className="absolute right-20 top-28 h-40 w-40 rounded-full border border-white/10" />

              <div className="absolute bottom-20 left-10 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
            </div>

            <div className="relative">
              <div className="mb-12 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-lg backdrop-blur">
                  <Building2 size={24} />
                </div>

                <div>
                  <p className="text-sm font-black tracking-[0.18em]">
                    THREE LEAVES
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Enterprise Resource
                    Planning
                  </p>
                </div>
              </div>

              <div className="max-w-md">
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-200">
                  <ShieldCheck
                    size={14}
                  />

                  Protected workspace
                </span>

                <h1 className="mt-7 text-5xl font-black leading-[1.08] tracking-tight">
                  Your operations,

                  <span className="block bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent">
                    connected securely.
                  </span>
                </h1>

                <p className="mt-6 text-base leading-7 text-slate-300">
                  Sign in to manage invoices,
                  inventory, customers, delivery
                  planning, and business reporting
                  from one workspace.
                </p>
              </div>
            </div>

            <div className="relative grid gap-3">
              {[
                'Centralised business records',
                'Role-ready account access',
                'Responsive desktop and mobile layout',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200 backdrop-blur"
                >
                  <CheckCircle2
                    className="shrink-0 text-blue-300"
                    size={17}
                  />

                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-h-[680px] items-center bg-white px-6 py-10 sm:px-12 lg:px-16">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-9 lg:hidden">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Building2
                      size={22}
                    />
                  </div>

                  <div>
                    <p className="text-sm font-black tracking-[0.16em] text-slate-900">
                      THREE LEAVES
                    </p>

                    <p className="text-xs text-slate-500">
                      Enterprise Resource
                      Planning
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-8 ring-blue-50/60">
                  <LockKeyhole
                    size={27}
                  />
                </div>

                <h2 className="text-3xl font-black tracking-tight text-slate-950">
                  Welcome back
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Enter your authorised account
                  details to continue.
                </p>
              </div>

              <form
                className="space-y-5"
                onSubmit={handleSubmit}
                noValidate
              >
                {loginError && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700"
                  >
                    <AlertCircle
                      className="mt-0.5 shrink-0"
                      size={18}
                    />

                    <span className="font-semibold">
                      {loginError}
                    </span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="login-username"
                    className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-600"
                  >
                    Username
                  </label>

                  <div className="group relative">
                    <UserRound
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600"
                      size={19}
                    />

                    <input
                      ref={usernameInputRef}
                      id="login-username"
                      name="username"
                      type="text"
                      value={username}
                      onChange={(event) => {
                        setUsername(
                          event.target.value
                        );

                        clearError();
                      }}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck="false"
                      disabled={
                        isSubmitting ||
                        isLocked
                      }
                      placeholder="Enter your username"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label
                      htmlFor="login-password"
                      className="text-xs font-black uppercase tracking-[0.12em] text-slate-600"
                    >
                      Password
                    </label>

                    {capsLockOn && (
                      <span className="text-[11px] font-bold text-amber-600">
                        Caps Lock is on
                      </span>
                    )}
                  </div>

                  <div className="group relative">
                    <KeyRound
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600"
                      size={19}
                    />

                    <input
                      ref={passwordInputRef}
                      id="login-password"
                      name="password"
                      type={
                        showPassword
                          ? 'text'
                          : 'password'
                      }
                      value={password}
                      onChange={(event) => {
                        setPassword(
                          event.target.value
                        );

                        clearError();
                      }}
                      onKeyDown={
                        handleCapsLock
                      }
                      onKeyUp={
                        handleCapsLock
                      }
                      onBlur={() =>
                        setCapsLockOn(false)
                      }
                      autoComplete="current-password"
                      disabled={
                        isSubmitting ||
                        isLocked
                      }
                      placeholder="Enter your password"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-12 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      required
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (current) =>
                            !current
                        )
                      }
                      disabled={
                        isSubmitting ||
                        isLocked
                      }
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={
                        showPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                      title={
                        showPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={
                      rememberUsername
                    }
                    onChange={(event) =>
                      setRememberUsername(
                        event.target.checked
                      )
                    }
                    disabled={
                      isSubmitting ||
                      isLocked
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />

                  Remember my username on this
                  device
                </label>

                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    isLocked
                  }
                  className="group flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white shadow-xl shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-blue-700/20 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-slate-400 disabled:shadow-none"
                >
                  {isLocked
                    ? `Try again in ${remainingLockSeconds}s`
                    : isSubmitting
                      ? 'Signing in...'
                      : 'Sign in securely'}

                  {!isLocked &&
                    !isSubmitting && (
                      <ArrowRight
                        size={18}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    )}
                </button>
              </form>

              <div className="mt-8 flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3.5 text-xs leading-5 text-slate-500">
                <ShieldCheck
                  className="mt-0.5 shrink-0 text-emerald-600"
                  size={17}
                />

                <p>
                  Your password is never saved by
                  this page. For account access or
                  a password reset, contact your
                  system administrator.
                </p>
              </div>

              <p className="mt-8 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                © {new Date().getFullYear()}{' '}
                Three Leaves Enterprise
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
