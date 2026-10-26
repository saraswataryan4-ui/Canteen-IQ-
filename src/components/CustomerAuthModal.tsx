import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { CustomerAccount } from '../types';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'login' | 'signup';
  promptMessage?: string;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
  promptMessage,
}) => {
  const { signInWithGoogle, loginWithEmailOtp, customer, user, updateCustomerPhone } =
    useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [step, setStep] = useState<'input' | 'otp' | 'phone_prompt'>('input');

  // Input fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [domainWarning, setDomainWarning] = useState<string | null>(null);
  const [serverNotice, setServerNotice] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [verifiedCustomer, setVerifiedCustomer] = useState<CustomerAccount | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setStep('input');
    setErrorMessage(null);
    setDomainWarning(null);
    setServerNotice(null);
    setOtpCode('');
  }, [initialMode, isOpen]);

  // Prevent background scrolling while modal is active & restore on close/unmount
  // Also attach Escape key dismissal
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setDomainWarning(null);
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      // Check if phone number is needed
      if (!phone && !customer?.phone) {
        setStep('phone_prompt');
      } else {
        onSuccess?.();
        onClose();
      }
    } catch (err: unknown) {
      const errCode = (err as { code?: string })?.code || '';
      const errMsg = err instanceof Error ? err.message : String(err);

      if (
        errCode === 'auth/unauthorized-domain' ||
        errMsg.includes('auth/unauthorized-domain')
      ) {
        const currentHostname =
          typeof window !== 'undefined'
            ? window.location.hostname
            : 'ais-dev-rwgpunt3mdehhrewburpnk-150816236390.asia-northeast1.run.app';

        setDomainWarning(
          `Domain Authorization Required: "${currentHostname}" must be added to Authorized domains in Firebase Console (Authentication > Settings > Authorized domains) for Google Sign-In to proceed. In the meantime, you can sign up or log in below using your email address.`
        );
      } else if (
        errCode === 'auth/popup-closed-by-user' ||
        errMsg.includes('popup-closed-by-user')
      ) {
        setErrorMessage('Sign-in popup was closed before completion. Please try again.');
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : 'Google authentication failed'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setServerNotice(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setErrorMessage('Please enter your full name.');
        return;
      }
      if (!phone.trim() || phone.trim().length < 7) {
        setErrorMessage('Please enter a valid phone number (at least 7 digits).');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          mode,
          name: name.trim(),
          phone: phone.trim(),
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        if (data.errorCode === 'EMAIL_ALREADY_EXISTS') {
          setErrorMessage(
            `${data.error} Click below to switch to existing account login.`
          );
        } else {
          setErrorMessage(data.error || 'Failed to send verification code.');
        }
        if (data.cooldownSeconds) {
          setCooldownSeconds(data.cooldownSeconds);
        }
        return;
      }

      setCooldownSeconds(data.cooldownSeconds || 60);
      setServerNotice(data.message);
      setStep('otp');
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to reach authentication server.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: cleanCode,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        setErrorMessage(data.error || 'Invalid or expired verification code.');
        return;
      }

      // const cust = data.customer as CustomerAccount;
      // setVerifiedCustomer(cust);
      // loginWithEmailOtp(cust);
      const cust = data.customer as CustomerAccount;

      if (typeof data.firebaseCustomToken !== 'string' ||
          !data.firebaseCustomToken) {
        setErrorMessage(
          'Verification succeeded, but Firebase session could not be created. Please try again.'
        );
        return;
      }

      setVerifiedCustomer(cust);
      await loginWithEmailOtp(cust, data.firebaseCustomToken);

      // Brief delay to display success badge
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 900);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to verify code with server.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePhoneForGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || phone.trim().length < 7) {
      setErrorMessage('Please provide a valid phone number for your order updates.');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateCustomerPhone(phone.trim());
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save phone number');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalElement = (
    <div
      className="fixed inset-0 z-[99999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto box-border"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-auth-modal-title"
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto box-border p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-2">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2
            id="customer-auth-modal-title"
            className="text-2xl font-bold tracking-tight text-slate-950"
          >
            {step === 'phone_prompt'
              ? 'Complete Your Profile'
              : mode === 'signup'
              ? 'Create Customer Account'
              : 'Customer Sign In'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            {promptMessage ||
              (mode === 'signup'
                ? 'Register to place campus food orders and view your real-time token history.'
                : 'Log in with your Google account or email verification code.')}
          </p>
        </div>

        {/* Domain Warning (auth/unauthorized-domain guidance) */}
        {domainWarning && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Firebase Configuration Notice</span>
            </div>
            <p>{domainWarning}</p>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div className="space-y-1">
              <p>{errorMessage}</p>
              {errorMessage.includes('switch to') && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage(null);
                  }}
                  className="text-xs font-semibold underline text-red-900 hover:text-red-950 cursor-pointer block mt-1"
                >
                  Switch to Existing Account Login →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step: Google Phone Prompt */}
        {step === 'phone_prompt' && (
          <form onSubmit={handleSavePhoneForGoogle} className="space-y-4">
            <p className="text-xs text-slate-600">
              Welcome, <span className="font-semibold">{user?.displayName || 'Student'}</span>! Please provide your mobile number for kitchen order delivery &amp; SMS token notifications:
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                Phone Number
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-emerald-600"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Save and Continue'}
            </button>
          </form>
        )}

        {/* Step: OTP Verification */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {serverNotice && (
              <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <Mail className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Verification Code Dispatched</span>
                </div>
                <p className="text-emerald-900">{serverNotice}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  Enter 6-Digit Verification Code
                </span>
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> 5-min expiry
                </span>
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full text-center text-2xl font-mono tracking-widest px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-emerald-600"
              />
            </div>

            {verifiedCustomer && (
              <div className="p-3 rounded-xl bg-emerald-100 border border-emerald-300 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>
                  Account Verified! Customer ID:{' '}
                  <span className="font-mono font-bold">
                    {verifiedCustomer.customerId}
                  </span>
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || otpCode.length !== 6}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying on Server...</span>
                </>
              ) : (
                <>
                  <span>Verify &amp; Activate Session</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={() => setStep('input')}
                className="text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Change Email
              </button>

              <button
                type="button"
                disabled={cooldownSeconds > 0 || isSubmitting}
                onClick={() => void handleSendOtp()}
                className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 disabled:text-slate-400 cursor-pointer disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-3 h-3" />
                {cooldownSeconds > 0
                  ? `Resend code in ${cooldownSeconds}s`
                  : 'Resend Verification Code'}
              </button>
            </div>
          </form>
        )}

        {/* Step: Initial Input (Google + Email Form) */}
        {step === 'input' && (
          <div className="space-y-5">
            {/* Option 1: Continue with Google */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full py-3 px-4 inline-flex items-center justify-center gap-3 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
              )}
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Or with Email Code
              </span>
            </div>

            {/* Mode Selector Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                }}
                className={`py-2 rounded-lg transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-emerald-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMessage(null);
                }}
                className={`py-2 rounded-lg transition-colors cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white text-emerald-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSendOtp} className="space-y-3.5">
              {mode === 'signup' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Aryan Saraswat"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-emerald-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-emerald-600"
                    />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@campus.edu"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-emerald-600"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 mt-2 shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating Code...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {mode === 'signup'
                        ? 'Send 6-Digit Verification Code'
                        : 'Send Login Code'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
};
