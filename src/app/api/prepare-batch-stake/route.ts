import { NextRequest, NextResponse } from 'next/server';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/config';
import { encodeFunctionData } from 'viem';

export async function POST(request: NextRequest) {
  try {
    const { amount, duration, userAddress } = await request.json();

    if (!amount || !duration || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters: amount, duration, userAddress' },
        { status: 400 }
      );
    }

          // Convert amount to BigInt (assuming 18 decimals for METRIK)
      const amountInWei = BigInt(Math.floor(parseFloat(amount) * 1e18));
      
      // Convert duration from DAYS to SECONDS (contract expects seconds)
      const durationInDays = parseInt(duration);
      const durationInSeconds = BigInt(durationInDays * 24 * 60 * 60);

      // Validate duration (contract requirements: 3 minutes to 365 days)
      const minDurationSeconds = 3 * 60; // 3 minutes
      const maxDurationSeconds = 365 * 24 * 60 * 60; // 365 days
      
      if (durationInDays * 24 * 60 * 60 < minDurationSeconds) {
        return NextResponse.json(
          { error: 'Duration too short. Minimum is 3 minutes (0.002 days).' },
          { status: 400 }
        );
      }
      
      if (durationInDays * 24 * 60 * 60 > maxDurationSeconds) {
        return NextResponse.json(
          { error: 'Duration too long. Maximum is 365 days.' },
          { status: 400 }
        );
      }

      console.log('🔄 Preparing batch transaction for:', {
        amount,
        duration: `${duration} days`,
        durationInSeconds: durationInSeconds.toString(),
        userAddress,
        amountInWei: amountInWei.toString()
      });

    // Step 1: Approval transaction data
    const approvalData = encodeFunctionData({
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
      args: [CONTRACT_ADDRESSES.STAKING as `0x${string}`, amountInWei],
    });

            // Step 2: Staking transaction data
        const stakeData = encodeFunctionData({
          abi: [
            {
              inputs: [
                { name: 'amount', type: 'uint256' },
                { name: 'duration', type: 'uint256' }
              ],
              name: 'stake',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function'
            }
          ],
          functionName: 'stake',
          args: [amountInWei, durationInSeconds], // Use converted duration in seconds
        });

    // Step 3: Prepare batch transaction calls
    const batchCalls = [
      {
        to: CONTRACT_ADDRESSES.METRIK_TOKEN,
        data: approvalData,
        value: '0',
        description: 'Approve METRIK tokens for staking'
      },
      {
        to: CONTRACT_ADDRESSES.STAKING,
        data: stakeData,
        value: '0',
        description: 'Stake METRIK tokens'
      }
    ];

    console.log('✅ Batch transaction prepared:', {
      totalCalls: batchCalls.length,
      approvalTo: CONTRACT_ADDRESSES.METRIK_TOKEN,
      stakingTo: CONTRACT_ADDRESSES.STAKING
    });

    return NextResponse.json({
      success: true,
      batchCalls,
      summary: {
        action: 'Stake METRIK Tokens',
        amount: `${amount} METRIK`,
        duration: `${duration} days`,
        steps: [
          'Approve METRIK tokens for staking contract',
          'Stake tokens with specified duration'
        ]
      }
    });

  } catch (error) {
    console.error('❌ Error preparing batch transaction:', error);
    return NextResponse.json(
      { 
        error: 'Failed to prepare batch transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 