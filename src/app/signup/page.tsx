import { AuthCard } from '@/components/auth/ui';
import { SignupForm } from '@/components/auth/SignupForm';
import { INDUSTRIES } from '@/lib/onboarding/industries';

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ industry?: string }> }) {
  const { industry } = await searchParams;
  const initialIndustry = INDUSTRIES.find((value) => value === industry) ?? '';
  return (
    <AuthCard title={initialIndustry === 'MOBILE_CAR_WASH' ? 'Start your mobile car wash workspace' : 'Start your free trial'} subtitle="30 days free. No card needed.">
      <SignupForm initialIndustry={initialIndustry} />
    </AuthCard>
  );
}
