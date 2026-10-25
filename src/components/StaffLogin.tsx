import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  KeyRound,
  Loader2,
  Lock,
  Shield,
  ShieldAlert,
  User,
  UserCheck,
} from 'lucide-react';
import { BOOTSTRAP_ADMIN_EMAIL, useAuth } from '../auth/AuthContext';

interface StaffLoginProps {
  onLoginSuccess: () => void;
  onReturnToStudentSite: () => void;
  initialTab?: 'staff' | 'admin';
}

export const StaffLogin: React.FC<StaffLoginProps> = ({
  onLoginSuccess,
  onReturnToStudentSite,
  initialTab = 'staff',
}) => {
  const {
    user,
    isAuthenticated,
    isAdmin,
    signInWithGoogle,
    signOutUser,
    loginStaff,
    isStaffAuthenticated,
    staffSession,
  } = useAuth();

  const [activePortal, setActivePortal] = useState<'staff' | 'admin'>(initialTab);
  const [staffIdentifier, setStaffIdentifier] = useState('');
  const [staffPasscode, setStaffPasscode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already authenticated as staff or admin, auto redirect
  React.useEffect(() => {
    if (isStaffAuthenticated) {
      onLoginSuccess();
    }
  }, [isStaffAuthenticated, onLoginSuccess]);

  const handleStaffFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    const cleanId = staffIdentifier.trim();
    const cleanPass = staffPasscode.trim();

    if (!cleanId || !cleanPass) {
      setErrorMessage('Please enter both your Staff ID/Email and Passcode.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await loginStaff(cleanId, cleanPass);
      if (!result.ok) {
        setErrorMessage(result.error || 'Invalid staff credentials.');
        return;
      }
      onLoginSuccess();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Server authentication failed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminGoogleSignIn = async () => {
    if (isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      // AuthContext handles verification of saraswataryan2312@gmail.com or /admins/{uid}
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Google authentication failed'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={onReturnToStudentSite}
            className="text-xl font-bold tracking-tight text-emerald-950 hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            CanteenIQ
          </button>

          <nav
            aria-label="Portal Switch"
            className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <span className="text-emerald-800 font-semibold whitespace-nowrap shrink-0">
              {activePortal === 'admin'
                ? 'Administrator Access Portal'
                : 'Canteen Staff Portal'}
            </span>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onReturnToStudentSite}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Public Menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="max-w-lg w-full space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            {/* Entry point tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setActivePortal('staff');
                  setErrorMessage(null);
                }}
                className={`py-2.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                  activePortal === 'staff'
                    ? 'bg-white text-emerald-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Staff Login</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePortal('admin');
                  setErrorMessage(null);
                }}
                className={`py-2.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                  activePortal === 'admin'
                    ? 'bg-white text-emerald-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Login</span>
              </button>
            </div>

            {/* Header info */}
            <div className="space-y-1.5 text-center">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2 ${
                  activePortal === 'admin'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {activePortal === 'admin' ? (
                  <Shield className="w-6 h-6" />
                ) : (
                  <Lock className="w-6 h-6" />
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                {activePortal === 'admin'
                  ? 'Administrator Sign In'
                  : 'Canteen Staff Sign In'}
              </h1>
              <p className="text-sm text-slate-600">
                {activePortal === 'admin'
                  ? 'Authorized administrator login with Google to manage staff accounts, orders, inventory, and system audit logs.'
                  : 'Enter your assigned Staff ID or email and passcode to view the kitchen orders queue and update food readiness.'}
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs font-medium text-red-800"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Tab 1: Staff Login Form */}
            {activePortal === 'staff' && (
              <form onSubmit={handleStaffFormSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    Staff ID or Staff Email
                  </label>
                  <input
                    type="text"
                    required
                    value={staffIdentifier}
                    onChange={(e) => setStaffIdentifier(e.target.value)}
                    placeholder="e.g. STF-101 or rajesh.verma@canteeniq.campus"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-emerald-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    Staff Passcode
                  </label>
                  <input
                    type="password"
                    required
                    value={staffPasscode}
                    onChange={(e) => setStaffPasscode(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-emerald-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Staff Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Enter Staff Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Tab 2: Admin Login (Google Auth) */}
            {activePortal === 'admin' && (
              <div className="space-y-4">
                {isAuthenticated && user && !isAdmin && (
                  <div
                    role="alert"
                    className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs text-amber-950"
                  >
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-amber-700" />
                      <span>Access Restricted (Not an Administrator)</span>
                    </div>
                    <p>
                      You are signed in as{' '}
                      <span className="font-mono font-semibold">{user.email}</span>.
                      This account does not have administrator privileges.
                    </p>
                    <p className="text-slate-600">
                      Authorized Administrator:{' '}
                      <span className="font-mono font-medium text-slate-800">
                        {BOOTSTRAP_ADMIN_EMAIL}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => void signOutUser()}
                      className="mt-1 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 cursor-pointer"
                    >
                      Sign Out and Use Admin Account
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAdminGoogleSignIn}
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 inline-flex items-center justify-center gap-3 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
                      <span>Authenticating with Google...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Sign In with Administrator Google Account</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
