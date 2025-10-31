import { useState, useCallback } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { useWallets, useSendTransaction } from '@privy-io/react-auth';
import { contracts } from '@/lib/wagmi/config';
import { toast } from 'react-toastify';

export function useOneClickRepay() {
  const publicClient = usePublicClient();
  const { address: wagmiAddress } = useAccount();
  const { wallets: privyWallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  
  const [isExecuting, setIsExecuting] = useState(false);

  const executeOneClickRepay = useCallback(async (
    invoiceId: string
  ) => {
    if (isExecuting) {
      console.log('⚠️ Already executing, skipping duplicate call');
      return;
    }
    setIsExecuting(true);

    try {
      // Get the user address
      const userAddress = wagmiAddress || privyWallets?.[0]?.address;
      if (!userAddress) {
        throw new Error('No wallet address found. Please connect your wallet.');
      }

      console.log('🚀 Starting seamless repayment for invoice:', invoiceId);

      // Step 1: Prepare batch transactions via backend API
      console.log('📡 Preparing batch repay transaction via API...');
      console.log('📡 API request payload:', { invoiceId, userAddress });
      
      const response = await fetch('/api/prepare-batch-repay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId,
          userAddress,
        }),
      });

      console.log('📡 API response status:', response.status);
      console.log('📡 API response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to prepare repay transaction');
      }

      const { batchCalls, summary } = await response.json();
      console.log('✅ Batch repay transaction prepared:', summary);

      // Step 2: Execute the batch transactions
      console.log('🔄 Executing batch repay transactions...');

      // Pre-repay on-chain snapshot and simulation to surface revert reasons
      try {
        const id = BigInt(invoiceId);
        const [loanDetails, allowance, musdBal, ownerOf] = await Promise.all([
          publicClient!.readContract({ address: contracts.lendingPool.address, abi: contracts.lendingPool.abi, functionName: 'getUserLoanDetails', args: [userAddress as `0x${string}`, id] }),
          publicClient!.readContract({ address: contracts.musd.address, abi: contracts.musd.abi, functionName: 'allowance', args: [userAddress as `0x${string}`, contracts.lendingPool.address] }),
          publicClient!.readContract({ address: contracts.musd.address, abi: contracts.musd.abi, functionName: 'balanceOf', args: [userAddress as `0x${string}`] }),
          publicClient!.readContract({ address: contracts.invoiceNFT.address, abi: contracts.invoiceNFT.abi, functionName: 'ownerOf', args: [id] }),
        ]);
        console.log('🔎 Repay precheck', {
          invoiceId,
          // getUserLoanDetails returns [amount, dueDate, isRepaid, isLiquidated, interestAccrued]
          amount: (loanDetails as any)?.[0]?.toString?.(),
          dueDate: (loanDetails as any)?.[1]?.toString?.(),
          isRepaid: (loanDetails as any)?.[2],
          isLiquidated: (loanDetails as any)?.[3],
          interestAccrued: (loanDetails as any)?.[4]?.toString?.(),
          invoiceOwner: ownerOf,
          allowance: (allowance as bigint)?.toString?.(),
          musdBalance: (musdBal as bigint)?.toString?.(),
          lendingPool: contracts.lendingPool.address,
          musd: contracts.musd.address,
        });

        try {
          await publicClient!.simulateContract({
            account: userAddress as `0x${string}`,
            address: contracts.lendingPool.address,
            abi: contracts.lendingPool.abi,
            functionName: 'repay',
            args: [id],
          });
          console.log('🔎 Repay simulation passed (no revert)');
        } catch (simErr) {
          console.error('🛑 Repay simulation reverted (root cause):', simErr);
        }
      } catch (e) {
        console.warn('Repay precheck failed', e);
      }
      
      const results = [];
      for (let i = 0; i < batchCalls.length; i++) {
        const call = batchCalls[i];
        console.log(`📤 Executing transaction ${i + 1}/${batchCalls.length}:`, call.description);
        
        const tx = await sendTransaction(
          {
            to: call.to as `0x${string}`,
            data: call.data as `0x${string}`,
            value: BigInt(call.value),
            chainId: publicClient?.chain.id,
          },
          {
            uiOptions: {
              showWalletUIs: false, // COMPLETELY HIDE WALLET UI
            }
          }
        );
        
        console.log(`✅ Transaction ${i + 1} submitted:`, tx.hash);
        results.push(tx);
        
        // Wait for confirmation
        await publicClient?.waitForTransactionReceipt({ hash: tx.hash });
        console.log(`✅ Transaction ${i + 1} confirmed:`, tx.hash);
      }

      console.log('🎉 All repay transactions completed successfully!');
      
      // Show success message with benefits
      toast.success('🎉 Seamless Repayment Completed! Zero wallet prompts required. Invoice NFT burned. Loan settled.', {
        autoClose: 8000,
      });

      return results[results.length - 1].hash; // Return the final transaction hash

    } catch (error) {
      console.error('❌ Seamless repayment failed:', error);
      
      let errorMessage = 'Repayment failed. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('InsufficientBalance')) {
          errorMessage = 'Insufficient MUSD balance for repayment. Please mint more MUSD.';
        } else if (error.message.includes('LoanAlreadySettled')) {
          errorMessage = 'This loan has already been repaid.';
        } else if (error.message.includes('NotLoanOwner')) {
          errorMessage = 'You are not the owner of this loan.';
        } else if (error.message.includes('InvoiceNotVerified')) {
          errorMessage = 'Invoice not verified. Cannot repay.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsExecuting(false);
    }
  }, [wagmiAddress, privyWallets, sendTransaction, publicClient, isExecuting]);

  return {
    executeOneClickRepay,
    isExecuting,
  };
} 