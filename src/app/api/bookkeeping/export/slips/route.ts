import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { canUse } from '@/lib/plans/plans';
import { resolvePeriod } from '@/lib/bookkeeping/period';
import { slipPhotosZip } from '@/lib/bookkeeping/export';

export async function GET(request: NextRequest) {
  const { tenant } = await requireRole();
  if (!canUse(tenant, 'accountantExport')) return new NextResponse('Not available on this package.', { status: 403 });

  const period = resolvePeriod(request.nextUrl.searchParams.get('period') ?? undefined, tenant.timezone);
  const zip = await slipPhotosZip(tenantDb(tenant.id), period.start, period.end);

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="slips-${period.key}.zip"`,
    },
  });
}
