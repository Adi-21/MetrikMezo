import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing ID parameter' },
        { status: 400 }
      );
    }

    // Get ZK KYC record from Supabase
    const { data, error } = await supabase
      .from('zk_kyc_records')
      .select('*')
      .eq('id', id.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('Error fetching ZK KYC record:', error);
      return NextResponse.json(
        { error: 'Failed to fetch ZK KYC record' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ record: null });
    }

    // Transform database record to frontend format
    const record = {
      id: data.id,
      walletAddress: data.wallet_address,
      kycStatus: data.kyc_status,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      companyDataHash: data.company_data_hash,
      documentHashes: JSON.parse(data.document_hashes || '[]'),
      kycProofHash: data.kyc_proof_hash,
      proofPublicSignals: JSON.parse(data.proof_public_signals || '[]'),
      verificationLevel: data.verification_level,
      expiryDate: data.expiry_date ? new Date(data.expiry_date).getTime() : null,
      jurisdiction: data.jurisdiction,
      encryptedData: data.encrypted_data
    };

    return NextResponse.json({ record });
  } catch (error) {
    console.error('ZK KYC status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
