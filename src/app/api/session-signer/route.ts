import { NextRequest, NextResponse } from 'next/server';
import { 
  signTransactionWithSessionSigner, 
  signBatchTransactionsWithSessionSigner,
  type TransactionRequest,
  type BatchTransactionRequest 
} from '@/lib/privy-server';

export async function POST(request: NextRequest) {
  try {
    const { identityToken, action, transaction, batchTransactions } = await request.json();

    console.log('Session signer API called with:', {
      action,
      hasIdentityToken: !!identityToken,
      hasTransaction: !!transaction,
      hasBatchTransactions: !!batchTransactions,
    });

    if (!identityToken) {
      return NextResponse.json(
        { error: 'Identity token is required' },
        { status: 400 }
      );
    }

    // Handle single transaction
    if (action === 'signTransaction' && transaction) {
      console.log('Processing single transaction:', transaction);
      const result = await signTransactionWithSessionSigner(identityToken, transaction as TransactionRequest);
      console.log('Single transaction result:', result);
      return NextResponse.json(result);
    }

    // Handle batch transactions
    if (action === 'signBatchTransactions' && batchTransactions) {
      const results = await signBatchTransactionsWithSessionSigner(identityToken, batchTransactions as BatchTransactionRequest);
      return NextResponse.json({ results });
    }

    return NextResponse.json(
      { error: 'Invalid action or missing transaction data' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Session signer API error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to sign transaction';
    let status = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('Session signers not available')) {
        errorMessage = 'Session signers not configured. Please install @privy-io/server-auth and configure PRIVY_APP_SECRET.';
        status = 503; // Service Unavailable
      } else if (error.message.includes('No session signer wallets found')) {
        errorMessage = 'No session signer wallets found. Please enable session signers in your Privy dashboard.';
        status = 400;
      } else if (error.message.includes('Identity token')) {
        errorMessage = 'Authentication required. Please log in again.';
        status = 401;
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage, 
        details: error instanceof Error ? error.message : 'Unknown error',
        setupRequired: errorMessage.includes('not configured') || errorMessage.includes('not available')
      },
      { status }
    );
  }
} 