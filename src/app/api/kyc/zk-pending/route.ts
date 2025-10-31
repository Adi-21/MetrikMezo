import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Get all pending ZK KYC records from Supabase
    const { data, error } = await supabase
      .from('zk_kyc_records')
      .select('*')
      .eq('kyc_status', 'pending_review')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending ZK KYC records:', error);
      return NextResponse.json(
        { error: 'Failed to fetch pending ZK KYC records' },
        { status: 500 }
      );
    }

    // Transform database records to frontend format
    const records = data?.map(record => ({
      id: record.id,
      walletAddress: record.wallet_address,
      kycStatus: record.kyc_status,
      createdAt: new Date(record.created_at).getTime(),
      updatedAt: new Date(record.updated_at).getTime(),
      companyDataHash: record.company_data_hash,
      documentHashes: JSON.parse(record.document_hashes || '[]'),
      kycProofHash: record.kyc_proof_hash,
      proofPublicSignals: JSON.parse(record.proof_public_signals || '[]'),
      verificationLevel: record.verification_level,
      expiryDate: record.expiry_date ? new Date(record.expiry_date).getTime() : null,
      jurisdiction: record.jurisdiction,
      encryptedData: record.encrypted_data
    })) || [];

    return NextResponse.json({ records });
  } catch (error) {
    console.error('ZK KYC pending error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
