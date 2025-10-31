import { useCallback, useState } from 'react';
import { useSendTransaction, usePrivy } from '@privy-io/react-auth';
import { toast } from 'react-toastify';

export function useOneClickStaking(wallets?: any[]) {
  const { authenticated } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const [isExecuting, setIsExecuting] = useState(false);

  const executeOneClickStake = useCallback(async (
    amount: string,
    duration: string
  ) => {
    if (!authenticated) {
      toast.error('Please login first');
      return;
    }

    if (!wallets || wallets.length === 0) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!amount || !duration) {
      toast.error('Please enter amount and duration');
      return;
    }

    setIsExecuting(true);
    
    try {
      // Use the specific privy wallet address, not just the first wallet
      const privyWallet = wallets.find(w => w.walletClientType === 'privy' || (w.meta && w.meta.id === 'io.privy.wallet'));
      const userAddress = privyWallet?.address || wallets[0]?.address;
      
      // Step 1: Prepare batch transaction on backend
      console.log('🔄 Preparing one-click stake transaction...');
      const response = await fetch('/api/prepare-batch-stake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          duration,
          userAddress
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to prepare transaction');
      }

      const { batchCalls, summary } = await response.json();
      
      console.log('✅ Batch transaction prepared:', summary);
      console.log('📋 Calls to execute:', batchCalls);

      // Step 2: Show user what will happen (only notification)
      toast.info(
        `🚀 Executing seamless stake: ${summary.amount} for ${summary.duration}`,
        { autoClose: 3000 }
      );
      
      // Debug: Log user's current state
      console.log('📊 Debug info before staking:', {
        userAddress,
        amount: `${amount} METRIK`,
        duration: `${duration} days`,
        stakingContract: batchCalls[1].to,
        metrikContract: batchCalls[0].to
      });

      const results = [];

      // Step 3: Execute approval transaction (COMPLETELY HIDDEN)
      console.log('🚀 Step 1: Approving tokens silently...');
      const approvalTx = await sendTransaction(
        {
          to: batchCalls[0].to as `0x${string}`,
          data: batchCalls[0].data as `0x${string}`,
          value: batchCalls[0].value,
        },
        {
          uiOptions: {
            showWalletUIs: false, // COMPLETELY HIDE WALLET UI
          }
        }
      );

      console.log('✅ Approval transaction submitted:', approvalTx.hash);
      results.push(approvalTx);

      // Wait for approval transaction to be confirmed on-chain
      console.log('⏳ Waiting for approval to be confirmed...');
      toast.info('⏳ Confirming approval transaction...', { autoClose: 3000 });
      
      // Wait longer for transaction confirmation (blockchain needs time)
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Step 4: Execute staking transaction (COMPLETELY HIDDEN)
      console.log('🚀 Step 2: Staking tokens silently...');
      const stakingTx = await sendTransaction(
        {
          to: batchCalls[1].to as `0x${string}`,
          data: batchCalls[1].data as `0x${string}`,
          value: batchCalls[1].value,
        },
        {
          uiOptions: {
            showWalletUIs: false, // COMPLETELY HIDE WALLET UI
          }
        }
      );

      console.log('✅ Staking completed silently:', stakingTx.hash);
      results.push(stakingTx);

      // Success feedback - removed the detailed toast as requested
      toast.success(
        `✅ Staking completed successfully!`,
        { 
          autoClose: 3000
        }
      );

      return {
        success: true,
        approvalHash: approvalTx.hash,
        stakingHash: stakingTx.hash,
        summary
      };

    } catch (error) {
      console.error('❌ Seamless staking failed:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.warn('Seamless staking cancelled');
        } else if (error.message.includes('insufficient funds')) {
          toast.error('Insufficient funds for staking');
              } else if (error.message.includes('vd') || error.message.includes('execution reverted')) {
        toast.error(
          `❌ Staking transaction failed! 
          💡 Possible causes:
          • Insufficient METRIK balance (need ${amount} METRIK)
          • Approval not yet confirmed on blockchain
          • Contract validation failed
          🏠 Try: Go to Home page → Claim more tokens
          🔄 Or use traditional staking method below`,
          { autoClose: 12000 }
        );
        } else {
          toast.error(`Seamless staking failed: ${error.message}`);
        }
      } else {
        toast.error('Seamless staking failed. Please try again.');
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

    } finally {
      setIsExecuting(false);
    }
  }, [authenticated, wallets, sendTransaction]);

  return {
    executeOneClickStake,
    isExecuting
  };
} 