import Link from 'next/link';
import QRCode from 'qrcode';
import { AuthCard } from '@/components/auth/ui';
import { CodeForm } from '@/components/auth/CodeForm';
import { requireAuth } from '@/lib/auth/session';
import { confirmTotpSetupAction, ensureTotpSetupSecret } from '@/lib/auth/actions';
import { totpUri } from '@/lib/auth/totp';

export default async function SecurityPage() {
  const { user, membership } = await requireAuth();

  if (user.totpEnabled) {
    return (
      <AuthCard title="Security" subtitle="Your authenticator app is switched on.">
        <p className="text-sm text-slate-300">
          Each time you log in you&apos;ll be asked for the 6-digit code from your authenticator app.
        </p>
        <Link href="/" className="mt-6 block text-center text-amber-400 hover:underline">
          Back to dashboard
        </Link>
      </AuthCard>
    );
  }

  const secret = (await ensureTotpSetupSecret())!;
  const qr = await QRCode.toDataURL(totpUri(secret, user.email ?? user.name), { margin: 1, width: 220 });
  const required = membership.role === 'OWNER';

  return (
    <AuthCard
      title="Protect your account"
      subtitle={
        required
          ? 'As the owner you can see money, bank details and customer information, so an authenticator app is required.'
          : 'Add a second step to your login for extra safety.'
      }
    >
      <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-slate-300">
        <li>
          Install <strong>Google Authenticator</strong> (or Microsoft Authenticator) from the Play Store or App Store.
        </li>
        <li>In the app, tap <strong>+</strong> then <strong>Scan a QR code</strong>, and scan this:</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="QR code for your authenticator app" className="mx-auto mb-3 rounded-lg bg-white p-2" width={220} height={220} />
      <p className="mb-5 text-center text-xs text-slate-500">
        Can&apos;t scan? Choose &ldquo;Enter a setup key&rdquo; and type:
        <br />
        <code className="mt-1 inline-block break-all font-mono text-slate-300">{secret.match(/.{1,4}/g)?.join(' ')}</code>
      </p>
      <ol start={3} className="mb-3 list-decimal pl-5 text-sm text-slate-300">
        <li>Type the 6-digit code the app now shows:</li>
      </ol>
      <CodeForm action={confirmTotpSetupAction} button="Switch on" />
    </AuthCard>
  );
}
