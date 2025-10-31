import { useState, useCallback } from 'react';
import { useContract } from './useContract';
import { usePublicClient, useAccount, useWalletClient } from 'wagmi';
import { toast } from 'react-toastify';

export function useLiquidation() {
  const { contract: lendingPoolContract } = useContract('lendingPool');
  const { contract: stakingContract } = useContract('staking');
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Function to liquidate a defaulted loan
  const liquidate = useCallback(async (tokenId: string, supplierId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!lendingPoolContract || !lendingPoolContract.address || !lendingPoolContract.abi) {
        throw new Error('Lending pool contract not available.');
      }

      if (!address) {
        throw new Error('Wallet not connected.');
      }

      if (!publicClient) {
        throw new Error('Public client not available. Please ensure network is connected.');
      }

      if (!walletClient) {
        throw new Error('Wallet client not available. Please ensure your wallet is connected.');
      }

      const parsedTokenId = BigInt(tokenId);
      const parsedSupplierId = BigInt(supplierId);

      const { request } = await publicClient.simulateContract({
        account: address,
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'liquidate',
        args: [parsedTokenId, parsedSupplierId],
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });

      toast.success('Liquidation successful!');
      return hash;
    } catch (err) {
      console.error('Error liquidating:', err);
      setError(err as Error);
      toast.error('Liquidation failed. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [lendingPoolContract, address, walletClient, publicClient]);

  // Function to slash staked tokens
  const slashStakedTokens = useCallback(async (userAddress: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!stakingContract || !stakingContract.address || !stakingContract.abi) {
        throw new Error('Staking contract not available.');
      }

      if (!address) {
        throw new Error('Wallet not connected.');
      }

      if (!publicClient) {
        throw new Error('Public client not available. Please ensure network is connected.');
      }

      if (!walletClient) {
        throw new Error('Wallet client not available. Please ensure your wallet is connected.');
      }

      const { request } = await publicClient.simulateContract({
        account: address,
        address: stakingContract.address,
        abi: stakingContract.abi,
        functionName: 'slashStakedTokens',
        args: [userAddress],
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });

      toast.success('Staked tokens slashed successfully!');
      return hash;
    } catch (err) {
      console.error('Error slashing staked tokens:', err);
      setError(err as Error);
      toast.error('Slashing staked tokens failed. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [stakingContract, address, walletClient, publicClient]);

  return {
    isLoading,
    error,
    liquidate,
    slashStakedTokens,
  };
} 