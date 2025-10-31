import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasPrivyAppSecret: !!process.env.PRIVY_APP_SECRET,
    hasPrivyAppId: !!process.env.NEXT_PUBLIC_PRIVY_APP_ID,
    appSecretLength: process.env.PRIVY_APP_SECRET?.length || 0,
    allEnvVars: Object.keys(process.env).filter(key => key.includes('PRIVY')),
  });
} 