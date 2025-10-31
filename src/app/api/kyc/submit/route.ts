import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const address = (formData.get('address') as string | null)?.toLowerCase() || undefined;
    const email = (formData.get('email') as string | null) || undefined;
    const companyName = (formData.get('companyName') as string | null) || undefined;
    const documentUrls = JSON.parse((formData.get('documentUrls') as string | null) || '[]');
    const imageUrls = JSON.parse((formData.get('imageUrls') as string | null) || '[]');
    const documentPaths = JSON.parse((formData.get('documentPaths') as string | null) || '[]');

    if (!address && !email) {
      return NextResponse.json({ error: 'Missing address or email' }, { status: 400 });
    }

    const id = (address || email!)!.toLowerCase();

    // Use lowercase keys to match Supabase columns
    const payload: Record<string, any> = {
      id,
      email,
      walletaddress: address,
      companyname: companyName,
      documentpaths: documentPaths,
      documenturls: documentUrls,
      imageurls: imageUrls,
      kycstatus: 'pending_review',
      rejectionreason: null,
      verifiablecredential: null,
      updatedat: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('kyc_records')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ success: true, record: data });
  } catch (error: any) {
    console.error('KYC submit error', error);
    return NextResponse.json({ error: 'Failed to submit KYC', details: error?.message || String(error) }, { status: 500 });
  }
}


