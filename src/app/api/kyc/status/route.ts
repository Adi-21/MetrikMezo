import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = (searchParams.get('address') || '').trim().toLowerCase();
  const email = (searchParams.get('email') || '').trim().toLowerCase();
  const id = (address || email).replace(/^<|>$/g, '');
  if (!id) return NextResponse.json({ kycStatus: 'not_submitted' });

  try {
    // Check regular KYC records first
    const { data: regularData, error: regularError } = await supabase
      .from('kyc_records')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (regularData && !regularError) {
      const status = (regularData as any)?.kycstatus || (regularData as any)?.kycStatus || 'not_submitted';
      return NextResponse.json({ 
        kycStatus: status, 
        record: regularData,
        type: 'regular'
      });
    }

    // If no regular KYC found, check ZK KYC records
    const { data: zkData, error: zkError } = await supabase
      .from('zk_kyc_records')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (zkData && !zkError) {
      return NextResponse.json({ 
        kycStatus: zkData.kyc_status || 'pending_review', 
        record: zkData,
        type: 'zk'
      });
    }

    // No KYC found in either table
    return NextResponse.json({ kycStatus: 'not_submitted' });

  } catch (error) {
    console.error('Error checking KYC status:', error);
    return NextResponse.json({ kycStatus: 'not_submitted' });
  }
}


