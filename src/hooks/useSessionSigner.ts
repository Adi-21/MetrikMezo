import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { usePrivy, useSessionSigners, useSendTransaction } from '@privy-io/react-auth';
import { encodeFunctionData } from 'viem';

export function useSessionSigner(wallets?: any[]) {
  const { getAccessToken, authenticated } = usePrivy();
  const { addSessionSigners } = useSessionSigners();
  const { sendTransaction } = useSendTransaction();

  const executeSeamlessTransaction = useCallback(async (
    to: string,
    data: string,
    value: bigint = 0n,
    chainId: number = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID!)
  ) => {
    try {
      if (!authenticated) {
        throw new Error('Please connect your wallet and login first');
      }

      const identityToken = await getAccessToken();
      if (!identityToken) {
        throw new Error('No identity token available. Please login again.');
      }

      console.log('🔍 Debug - Session signer transaction:', {
        to, data, value: value.toString(), chainId, identityToken: identityToken ? 'present' : 'missing',
      });

      try {
        const response = await fetch('/api/session-signer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identityToken, action: 'signTransaction', transaction: { to, data, value: value.toString(), chainId },
          }),
        });

        if (!response.ok) {
          let errorData;
          try { errorData = await response.json(); } catch (e) { errorData = { error: `HTTP ${response.status}: ${response.statusText}` }; }
          console.error('❌ Session signer API error response:', errorData);
          
          if (response.status === 500 && (errorData.details?.includes('Invalid Privy app ID') || errorData.error?.includes('Invalid Privy app ID'))) {
            console.warn('⚠️ Session signers not enabled in Privy Dashboard, falling back to regular wallet transaction');
            toast.info('Session signers not configured. Using regular wallet transaction...');
            return await executeRegularTransaction(to, data, value);
          } else if (response.status === 500 && errorData.setupRequired) {
            const errorMsg = 'Session signers not properly configured. Using wallet fallback.';
            console.error('🔧 Setup Instructions: 1. Go to https://dashboard.privy.io 2. Select your app: cmd45wlum039ql20myccjcwpv 3. Navigate to Configuration → Session Signers 4. Enable session signers for your app');
            toast.warn(errorMsg);
            return await executeRegularTransaction(to, data, value);
          } else if (response.status === 400) {
            throw new Error(errorData.error || 'Invalid transaction request');
          } else {
            throw new Error(errorData.error || errorData.details || `HTTP ${response.status}: Transaction failed`);
          }
        }

        const result = await response.json();
        console.log('✅ Session signer API success response:', result);
        if (result.success) {
          toast.success('Transaction completed successfully with session signer!');
          return result.hash;
        } else {
          throw new Error('Transaction failed on server');
        }
      } catch (sessionError) {
        console.warn('⚠️ Session signer failed, falling back to regular wallet transaction');
        console.error('Session signer error:', sessionError);
        return await executeRegularTransaction(to, data, value);
      }
    } catch (error) {
      console.error('❌ Transaction error:', error);
      if (error instanceof Error) {
        if (error.message.includes('Please connect')) { toast.error('Please connect your wallet and login first'); } else { toast.error(error.message); }
      } else { toast.error('Transaction failed. Please try again.'); }
      throw error;
    }
  }, [getAccessToken, authenticated]);

  // Fallback function for regular wallet transactions
  const executeRegularTransaction = useCallback(async (
    to: string,
    data: string,
    value: bigint = 0n
  ) => {
    console.log('🔄 Executing regular wallet transaction as fallback');
    console.log('📊 Wallet state:', {
      walletsLength: wallets?.length || 0,
      wallets: wallets?.map(w => ({
        address: w.address,
        type: w.walletClientType,
        connectorType: w.connectorType
      })) || []
    });
    
    if (!wallets || wallets.length === 0) {
      throw new Error('No wallets available. Please ensure you have a connected wallet.');
    }

    // Get the first available wallet (embedded or external)
    const wallet = wallets[0];
    console.log('📝 Using wallet:', {
      address: wallet.address,
      type: wallet.walletClientType,
      connectorType: wallet.connectorType
    });
    
    try {
      // Use Privy's native sendTransaction method
      toast.info('Please approve the transaction in your wallet');
      
      const transactionRequest = {
        to: to as `0x${string}`,
        data: data as `0x${string}`,
        value: value.toString(),
      };
      
      console.log('📋 Sending transaction:', transactionRequest);
      
      // Use Privy's sendTransaction hook
      const { hash } = await sendTransaction(transactionRequest);
      
      toast.success('Transaction submitted successfully!');
      console.log('✅ Transaction hash:', hash);
      return hash;
    } catch (error) {
      console.error('❌ Privy wallet transaction failed:', error);
      
      // Provide user-friendly error messages
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.error('Transaction was rejected by user');
        } else if (error.message.includes('insufficient funds')) {
          toast.error('Insufficient funds for transaction');
        } else {
          toast.error(`Transaction failed: ${error.message}`);
        }
      } else {
        toast.error('Transaction failed. Please try again.');
      }
      throw error;
    }
  }, [wallets, sendTransaction]);

  const executeSeamlessBatchTransactions = useCallback(async (
    transactions: Array<{
      to: string;
      data: string;
      value?: bigint;
    }>,
    chainId: number = parseInt(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID!)
  ) => {
    try {
      const identityToken = await getAccessToken();
      
      if (!identityToken) {
        throw new Error('No identity token available');
      }

      const response = await fetch('/api/session-signer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identityToken,
          action: 'signBatchTransactions',
          batchTransactions: {
            transactions: transactions.map(tx => ({
              to: tx.to,
              data: tx.data,
              value: (tx.value || 0n).toString(),
            })),
            chainId,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Batch transaction failed');
      }

      const result = await response.json();
      
      const successfulTransactions = result.results.filter((r: any) => r.success);
      const failedTransactions = result.results.filter((r: any) => !r.success);

      if (successfulTransactions.length > 0) {
        toast.success(`${successfulTransactions.length} transactions completed successfully!`);
      }

      if (failedTransactions.length > 0) {
        toast.warning(`${failedTransactions.length} transactions failed`);
      }

      return result.results;
    } catch (error) {
      console.error('Seamless batch transaction error:', error);
      toast.error(error instanceof Error ? error.message : 'Batch transaction failed');
      throw error;
    }
  }, [getAccessToken]);

  // Helper function to add session signers to a wallet with better error handling
  const addSessionSignerToWallet = useCallback(async (address: string) => {
    try {
      console.log('🔄 Adding session signers to wallet:', address);
      
      if (!authenticated) {
        throw new Error('Please login first before adding session signers');
      }
      
      // Try with basic embedded wallet session signers
      await addSessionSigners({
        address,
        signers: [{
          signerId: 'embedded',
          policyIds: []
        }]
      });
      
      toast.success('Session signers added to wallet successfully!');
      console.log('✅ Session signers added successfully');
    } catch (error) {
      console.error('❌ Error adding session signers:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('key quorums do not belong to the app')) {
          toast.error('Authorization key not properly configured. Please check your Privy dashboard settings.');
          console.error('🔧 Solution: Verify session signer configuration in Privy dashboard');
        } else if (error.message.includes('Invalid Privy app ID')) {
          toast.error('App ID configuration issue. Please verify your app settings.');
          console.error('🔧 Solution: Check NEXT_PUBLIC_PRIVY_APP_ID environment variable');
        } else if (error.message.includes('Please login')) {
          toast.error('Please login first before adding session signers');
        } else {
          toast.error(`Failed to add session signers: ${error.message}`);
        }
      } else {
        toast.error('Failed to add session signers. Please try again.');
      }
      throw error;
    }
  }, [addSessionSigners, authenticated]);

  // Helper function to encode approval transactions
  const encodeApproval = useCallback((tokenAddress: string, spenderAddress: string, amount: bigint) => {
    return encodeFunctionData({
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
  }, []);

  // Helper function to encode staking transactions
  const encodeStake = useCallback((amount: bigint, duration: bigint) => {
    return encodeFunctionData({
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
      args: [amount, duration],
    });
  }, []);

  // Helper function to encode borrowing transactions
  const encodeBorrow = useCallback((invoiceId: string, amount: bigint) => {
    return encodeFunctionData({
      abi: [
        {
          inputs: [
            { name: 'invoiceId', type: 'uint256' },
            { name: 'amount', type: 'uint256' }
          ],
          name: 'borrow',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ],
      functionName: 'borrow',
      args: [BigInt(invoiceId), amount],
    });
  }, []);

  // Helper function to encode repayment transactions
  const encodeRepay = useCallback((loanId: string, amount: bigint) => {
    return encodeFunctionData({
      abi: [
        {
          inputs: [
            { name: 'loanId', type: 'uint256' },
            { name: 'amount', type: 'uint256' }
          ],
          name: 'repay',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ],
      functionName: 'repay',
      args: [BigInt(loanId), amount],
    });
  }, []);

  return {
    executeSeamlessTransaction,
    executeSeamlessBatchTransactions,
    executeRegularTransaction,
    addSessionSignerToWallet,
    encodeApproval,
    encodeStake,
    encodeBorrow,
    encodeRepay,
  };
} 