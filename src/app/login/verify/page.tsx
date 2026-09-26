import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth/ui';
import { CodeForm } from '@/components/auth/CodeForm';
import { getRawSession } from '@/lib/auth/session';
import { verifyTotpAction } from '@/lib/auth/actions';

export default async function VerifyPage() {
  const session = await getRawSession();
  if (!session?.mfaPending) redirect('/login');

  return (
    <AuthCard title="Enter your security code" subtitle="Open Google Authenticator on your phone and type the code for ServiceKasi.">
      <CodeForm action={verifyTotpAction} button="Continue" />
    </AuthCard>
  );
}
