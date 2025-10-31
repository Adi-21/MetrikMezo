import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      walletAddress,
      kycStatus,
      companyDataHash,
      documentHashes,
      kycProofHash,
      proofPublicSignals,
      verificationLevel,
      expiryDate,
      jurisdiction,
      encryptedData
    } = body;

    // Validate required fields
    if (!id || !walletAddress || !companyDataHash) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Insert ZK KYC record into Supabase
    const { data, error } = await supabase
      .from('zk_kyc_records')
      .insert({
        id: id.toLowerCase(),
        wallet_address: walletAddress.toLowerCase(),
        kyc_status: kycStatus || 'pending_review',
        company_data_hash: companyDataHash,
        document_hashes: JSON.stringify(documentHashes || []),
        kyc_proof_hash: kycProofHash,
        proof_public_signals: JSON.stringify(proofPublicSignals || []),
        verification_level: verificationLevel || 1,
        expiry_date: expiryDate ? new Date(expiryDate).toISOString() : null,
        jurisdiction: jurisdiction || 'US',
        encrypted_data: encryptedData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting ZK KYC record:', error);
      return NextResponse.json(
        { error: 'Failed to store ZK KYC record' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, record: data });
  } catch (error) {
    console.error('ZK KYC submit error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
