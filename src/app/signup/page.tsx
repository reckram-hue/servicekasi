import { AuthCard } from '@/components/auth/ui';
import { SignupForm } from '@/components/auth/SignupForm';

export default function SignupPage() {
  return (
    <AuthCard title="Start your free trial" subtitle="30 days free. No card needed.">
      <SignupForm />
    </AuthCard>
  );
}
