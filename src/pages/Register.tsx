import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';

export default function Register() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <Package size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink">Accounts are invite-only</h1>
          <p className="mt-2 text-sm text-ink-muted">
            GearTrack accounts are created by your organization's admin. Ask them to add you, or contact us if you're setting up a new organization.
          </p>
        </div>

        <p className="text-center text-sm text-ink-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
