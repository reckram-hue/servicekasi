import { AuthCard } from '@/components/auth/ui';
import { LoginForms } from '@/components/auth/LoginForms';

const NOTICES: Record<string, string> = {
  'no-business': 'Your account is not linked to a business yet. Ask the owner to add you.',
  'no-access': 'You no longer have access to this business. Speak to the owner.',
  paused: 'Your business has more people than its current package allows, so this login is paused. Ask the owner to upgrade.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthCard title="Log in" subtitle="Run your service business from anywhere">
      <LoginForms notice={error ? NOTICES[error] : undefined} />
    </AuthCard>
  );
}
