import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await supabase
    .from('kyc_records')
    .select('*')
    .eq('kycstatus', 'pending_review');
  if (error) return NextResponse.json({ pending: [] });
  return NextResponse.json({ pending: data || [] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, id, reason } = body as { action: 'approve' | 'reject'; id: string; reason?: string };
    if (!action || !id) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const normalizedId = String(id).trim().toLowerCase().replace(/^<|>$/g, '');

    if (action === 'reject') {
      const { data, error } = await supabase
        .from('kyc_records')
        .update({ kycstatus: 'rejected', rejectionreason: reason || 'Not specified', updatedat: new Date().toISOString() })
        .eq('id', normalizedId)
        .select()
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ success: true, record: data });
    }

    // Approve: issue a simple VC-like signed JWT (dev-only)
    const { data: rec } = await supabase
      .from('kyc_records')
      .select('*')
      .eq('id', normalizedId)
      .maybeSingle();
    const wallet = (rec as any)?.walletaddress || normalizedId;
    const issuer = process.env.ZKYC_ISSUER_DID || 'did:metrik:issuer';
    const secret = new TextEncoder().encode(process.env.ZKYC_ISSUER_SECRET || 'dev-secret-change-me');

    const vcPayload = {
      iss: issuer,
      sub: `did:pkh:eip155:1:${wallet}`,
      iat: Math.floor(Date.now() / 1000),
      metrik: { kycVerified: true, verifiedBy: 'ProtocolVerifier' },
    };

    const jwt = await new SignJWT(vcPayload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .sign(secret);

    const { data: updated, error } = await supabase
      .from('kyc_records')
      .update({ kycstatus: 'verified', verifiablecredential: { jwt, payload: vcPayload }, updatedat: new Date().toISOString() })
      .eq('id', normalizedId)
      .select()
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ success: true, record: updated });
  } catch (error) {
    console.error('KYC admin error', error);
    return NextResponse.json({ error: 'Admin action failed' }, { status: 500 });
  }
}


