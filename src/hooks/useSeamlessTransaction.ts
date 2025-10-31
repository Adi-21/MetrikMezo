import { useCallback } from 'react';
import { useSendTransaction, useWallets } from '@privy-io/react-auth';
import { usePublicClient } from 'wagmi';
import { encodeFunctionData } from 'viem';
import { toast } from 'react-toastify';

export function useSeamlessTransaction() {
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useWallets();
  const publicClient = usePublicClient();

  const executeTransaction = useCallback(async (
    to: string,
    data: string,
    value: bigint = 0n,
    chainId?: number
  ) => {
    try {
      const { hash } = await sendTransaction({
        to: to as `0x${string}`,
        data,
        value,
        chainId: chainId || publicClient?.chain.id,
      });

      // Wait for transaction receipt
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      return hash;
    } catch (error) {
      console.error('Seamless transaction failed:', error);
      throw error;
    }
  }, [sendTransaction, publicClient]);

  const executeBatchTransactions = useCallback(async (
    transactions: Array<{
      to: string;
      data: string;
      value?: bigint;
    }>,
    chainId?: number
  ) => {
    const results = [];
    
    for (const tx of transactions) {
      try {
        const hash = await executeTransaction(
          tx.to,
          tx.data,
          tx.value || 0n,
          chainId
        );
        results.push({ success: true, hash });
      } catch (error) {
        results.push({ success: false, error });
        throw error; // Stop execution on first error
      }
    }
    
    return results;
  }, [executeTransaction]);

  // Pre-approve tokens to reduce future approval prompts
  const preApproveToken = useCallback(async (
    tokenAddress: string,
    spenderAddress: string,
    amount: bigint,
    chainId?: number
  ) => {
    try {
      const approveData = encodeFunctionData({
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
        args: [spenderAddress as `0x${string}`, amount],
      });

      return await executeTransaction(
        tokenAddress,
        approveData,
        0n,
        chainId
      );
    } catch (error) {
      console.error('Pre-approval failed:', error);
      throw error;
    }
  }, [executeTransaction]);

  return {
    executeTransaction,
    executeBatchTransactions,
    preApproveToken,
  };
} 