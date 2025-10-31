import { NextRequest, NextResponse } from 'next/server';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/config';
import { encodeFunctionData } from 'viem';

export async function POST(request: NextRequest) {
  try {
    const { supplier, uniqueId, amount, dueDate, metadata, userAddress } = await request.json();

    if (!supplier || !uniqueId || !amount || !dueDate || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters: supplier, uniqueId, amount, dueDate, userAddress' },
        { status: 400 }
      );
    }

    // Convert values to proper types
    const supplierAddress = supplier as `0x${string}`;
    const creditAmount = BigInt(Math.floor(parseFloat(amount) * 1e6)); // USDC has 6 decimals
    const dueDateTimestamp = BigInt(Math.floor(new Date(dueDate).getTime() / 1000));
    
    // Prepare IPFS metadata if provided
    let ipfsMetadata = metadata || `ipfs://placeholder-${uniqueId}`;
    
    console.log('🔄 Preparing invoice creation transaction for:', {
      supplier: supplierAddress,
      uniqueId,
      amount: `${amount} USDC`,
      dueDate: new Date(dueDate).toISOString(),
      creditAmount: creditAmount.toString(),
      dueDateTimestamp: dueDateTimestamp.toString(),
      metadata: ipfsMetadata,
      userAddress
    });

    // Step 1: Invoice NFT Minting transaction data
    const mintInvoiceData = encodeFunctionData({
      abi: [
        {
          inputs: [
            { name: 'supplier', type: 'address' },
            { name: 'uniqueId', type: 'string' },
            { name: 'creditAmount', type: 'uint256' },
            { name: 'dueDate', type: 'uint256' },
            { name: 'ipfsHash', type: 'string' }
          ],
          name: 'mintInvoiceNFT',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ],
      functionName: 'mintInvoiceNFT',
      args: [supplierAddress, uniqueId, creditAmount, dueDateTimestamp, ipfsMetadata],
    });

    // Step 2: Prepare transaction call (single transaction for invoice creation)
    const batchCalls = [
      {
        to: CONTRACT_ADDRESSES.INVOICE_NFT,
        data: mintInvoiceData,
        value: '0',
        description: 'Mint Invoice NFT with metadata'
      }
    ];

    console.log('✅ Invoice creation transaction prepared:', {
      totalCalls: batchCalls.length,
      mintTo: CONTRACT_ADDRESSES.INVOICE_NFT,
      supplier: supplierAddress,
      uniqueId
    });

    return NextResponse.json({
      success: true,
      batchCalls,
      summary: {
        action: 'Create Invoice NFT',
        invoiceId: uniqueId,
        amount: `${amount} USDC`,
        dueDate: new Date(dueDate).toLocaleDateString(),
        supplier: supplierAddress,
        steps: [
          'Upload metadata to IPFS (if provided)',
          'Mint Invoice NFT with credit details'
        ]
      }
    });

  } catch (error) {
    console.error('❌ Error preparing invoice creation transaction:', error);
    return NextResponse.json(
      { 
        error: 'Failed to prepare invoice creation transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 