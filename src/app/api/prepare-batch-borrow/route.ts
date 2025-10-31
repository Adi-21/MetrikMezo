import { NextRequest, NextResponse } from 'next/server';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/config';
import { encodeFunctionData } from 'viem';
import { createPublicClient, http, parseUnits } from 'viem';
import lendingPoolAbi from '@/lib/contracts/abis/LendingPool.json';
import invoiceNFTAbi from '@/lib/contracts/abis/InvoiceNFT.json';

// Patch in the Mezo testnet connection (hardcoded for backend validation)
const chain = {
  id: 31611,
  name: 'Mezo Testnet',
  network: 'mezo-testnet',
  nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.test.mezo.org'] } }
};
const publicClient = createPublicClient({
  chain, transport: http('https://rpc.test.mezo.org'), batch: { multicall: true } 
});

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, amount, userAddress } = await request.json();

    console.log('📥 Backend received:', { invoiceId, amount, userAddress, amountType: typeof amount });

    if (!invoiceId || !amount || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters: invoiceId, amount, userAddress' },
        { status: 400 }
      );
    }

    // Convert values to proper types
    const tokenId = BigInt(invoiceId);
    // The contract expects amounts in 6 decimal format (MUSD format)
    const borrowAmount = BigInt(Math.floor(parseFloat(amount) * 1e6)); // MUSD has 6 decimals

    // Chain check: get real on-chain max borrow for this invoice RIGHT NOW
    const maxBorrowOnChain = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.LENDING_POOL,
      abi: lendingPoolAbi.abi,
      functionName: 'getMaxBorrowAmount',
      args: [tokenId],
    }) as bigint;
    if (borrowAmount > maxBorrowOnChain) {
      return NextResponse.json({
        error: `Requested amount (${amount} MUSD) exceeds contract's real-time maximum available (${Number(maxBorrowOnChain)/1e6} MUSD). Please refresh and try again.`,
        code: 'MAX_BORROW_EXCEEDED',
        maxBorrow: Number(maxBorrowOnChain)/1e6,
        status: 400,
      }, { status: 400 });
    }

    console.log('🔄 Preparing batch borrow transaction for:', {
      invoiceId,
      amount: `${amount} MUSD`,
      tokenId: tokenId.toString(),
      borrowAmount: borrowAmount.toString(),
      userAddress
    });

    // Step 1: NFT Approval transaction data
    const nftApprovalData = encodeFunctionData({
      abi: [
        {
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'tokenId', type: 'uint256' }
          ],
          name: 'approve',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ],
      functionName: 'approve',
      args: [CONTRACT_ADDRESSES.INVOICE_NFT as `0x${string}`, tokenId],
    });

    // Step 2: Borrow transaction data
    const borrowData = encodeFunctionData({
      abi: [
        {
          inputs: [
            { name: 'tokenId', type: 'uint256' },
            { name: 'borrowAmount', type: 'uint256' }
          ],
          name: 'depositInvoiceAndBorrow',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ],
      functionName: 'depositInvoiceAndBorrow',
      args: [tokenId, borrowAmount],
    });

    // Step 3: Prepare batch transaction calls
    const batchCalls = [
      {
        to: CONTRACT_ADDRESSES.INVOICE_NFT,
        data: nftApprovalData,
        value: '0',
        description: 'Approve Invoice NFT for LendingPool'
      },
      {
        to: CONTRACT_ADDRESSES.LENDING_POOL,
        data: borrowData,
        value: '0',
        description: 'Borrow MUSD against invoice collateral'
      }
    ];

    console.log('✅ Batch borrow transaction prepared:', {
      totalCalls: batchCalls.length,
      nftApprovalTo: CONTRACT_ADDRESSES.INVOICE_NFT,
      borrowTo: CONTRACT_ADDRESSES.LENDING_POOL
    });

    return NextResponse.json({
      success: true,
      batchCalls,
      summary: {
        action: 'Borrow MUSD',
        amount: `${amount} MUSD`,
        invoiceId: invoiceId,
        steps: [
          'Approve Invoice NFT for LendingPool contract',
          'Borrow MUSD against invoice collateral'
        ],
        benefits: [
          'Zero wallet prompts required',
          'Automatic NFT approval handling',
          'Instant MUSD transfer to wallet',
          'Invoice NFT held as collateral'
        ],
        estimatedTime: '30-60 seconds',
        network: 'Mezo Testnet'
      }
    });

  } catch (error) {
    console.error('❌ Backend batch borrow error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error?.toString?.() }, { status: 500 });
  }
} 