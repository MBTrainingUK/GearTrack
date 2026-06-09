import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/useAuth';
import { Package, Mail, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VerifyEmail() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);

  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.emailVerified) return <Navigate to="/" replace />;

  async function checkVerified() {
    setChecking(true);
    try {
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        navigate('/');
      } else {
        toast.error('Not verified yet — please check your inbox and click the link');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setChecking(false);
    }
  }

  async function resendEmail() {
    if (!auth.currentUser) return;
    setSending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      toast.success('Verification email sent');
    } catch {
      toast.error('Failed to send email — please wait a moment and try again');
    } finally {
      setSending(false);
    }
  }

  async function handleSignOut() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <Package size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Verify your email</h1>
          <p className="mt-1 text-sm text-gray-500">One last step before you can access GearTrack</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-8 shadow-sm space-y-5">
          <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
            <Mail size={18} className="mt-0.5 shrink-0 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">Check your inbox</p>
              <p className="mt-0.5 text-xs text-blue-700">
                We sent a verification link to <strong>{currentUser.email}</strong>. Click the link in that email, then come back here.
              </p>
            </div>
          </div>

          <button
            onClick={checkVerified}
            disabled={checking}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {checking ? (
              <><RefreshCw size={14} className="animate-spin" /> Checking…</>
            ) : (
              "I've verified my email — let me in"
            )}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-100" />
            <span className="text-xs text-gray-400">didn't get it?</span>
            <div className="flex-1 border-t border-gray-100" />
          </div>

          <button
            onClick={resendEmail}
            disabled={sending}
            className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Resend verification email'}
          </button>
        </div>

        <p className="text-center text-sm text-gray-500">
          Wrong account?{' '}
          <button onClick={handleSignOut} className="font-medium text-blue-600 hover:underline">
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
