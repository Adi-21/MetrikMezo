import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, kycStatus } = body;

    if (!id || !kycStatus) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update ZK KYC record status in Supabase
    const { data, error } = await supabase
      .from('zk_kyc_records')
      .update({
        kyc_status: kycStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id.toLowerCase())
      .select()
      .single();

    if (error) {
      console.error('Error updating ZK KYC record:', error);
      return NextResponse.json(
        { error: 'Failed to update ZK KYC record' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, record: data });
  } catch (error) {
    console.error('ZK KYC update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
