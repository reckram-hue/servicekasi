import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRawSession } from '@/lib/auth/session'

// Lists every business on the platform — ServiceKasi staff only.
export async function GET() {
  const session = await getRawSession()
  if (!session || session.mfaPending || !session.user.isPlatformAdmin) {
    return NextResponse.json({ success: false, error: 'Not allowed' }, { status: 403 })
  }
  const tenants = await prisma.tenant.findMany({ select: { id: true, businessName: true, slug: true, createdAt: true } })
  return NextResponse.json({ success: true, tenants })
}
