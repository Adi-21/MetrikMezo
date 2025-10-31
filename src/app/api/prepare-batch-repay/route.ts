import { NextRequest, NextResponse } from 'next/server';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/config';
import { encodeFunctionData } from 'viem';

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, userAddress } = await request.json();

    console.log('📥 Backend received repay request:', { invoiceId, userAddress });

    if (!invoiceId || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters: invoiceId, userAddress' },
        { status: 400 }
      );
    }

    // Convert values to proper types
    const tokenId = BigInt(invoiceId);

    console.log('🔄 Preparing batch repay transaction for:', {
      invoiceId,
      tokenId: tokenId.toString(),
      userAddress
    });

    // Step 1: MUSD Approval transaction data (we'll approve a large amount to cover interest)
    const musdApprovalData = encodeFunctionData({
      abi: [
        {
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          name: 'approve',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ],
      functionName: 'approve',
      args: [CONTRACT_ADDRESSES.LENDING_POOL as `0x${string}`, BigInt(1000000 * 1e6)], // Approve 1M USDC to cover any amount
    });

    // Step 2: Repay transaction data
    const repayData = encodeFunctionData({
      abi: [
        {
          inputs: [
            { name: 'invoiceId', type: 'uint256' }
          ],
          name: 'repay',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ],
      functionName: 'repay',
      args: [tokenId],
    });

    // Step 3: Prepare batch transaction calls
    const batchCalls = [
      {
        to: CONTRACT_ADDRESSES.USDC,
        data: musdApprovalData,
        value: '0',
        description: 'Approve MUSD for LendingPool'
      },
      {
        to: CONTRACT_ADDRESSES.LENDING_POOL,
        data: repayData,
        value: '0',
        description: 'Repay loan and burn invoice NFT'
      }
    ];

    console.log('✅ Batch repay transaction prepared:', {
      totalCalls: batchCalls.length,
      musdApprovalTo: CONTRACT_ADDRESSES.USDC,
      repayTo: CONTRACT_ADDRESSES.LENDING_POOL
    });

    return NextResponse.json({
      success: true,
      batchCalls,
      summary: {
        action: 'Repay Loan',
        invoiceId: invoiceId,
        steps: [
          'Approve MUSD for LendingPool contract',
          'Repay loan and burn invoice NFT'
        ],
        benefits: [
          'Zero wallet prompts required',
          'Automatic MUSD approval handling',
          'Instant loan settlement',
          'Invoice NFT burned upon repayment'
        ],
        estimatedTime: '30-60 seconds',
        network: 'Mezo Testnet'
      }
    });

  } catch (error) {
    console.error('❌ Error preparing batch repay transaction:', error);
    return NextResponse.json(
      { 
        error: 'Failed to prepare batch repay transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 