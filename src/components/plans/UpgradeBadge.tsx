import Link from 'next/link';

/** A small "Team" / "Growth" pill next to a locked feature — tapping it explains why and links to Settings → Package. Never hides the feature outright; the real check is always server-side too (decision 5). */
export function UpgradeBadge({ plan }: { plan: string }) {
  return (
    <Link
      href="/settings/package"
      title={`This needs the ${plan} package`}
      className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300 hover:bg-amber-500/20"
    >
      {plan}
    </Link>
  );
}
