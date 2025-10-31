'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStaking } from '@/hooks/useStaking';
import { toast } from 'react-toastify';
import { parseAmount, formatAmount } from '@/lib/utils/contracts';
import { encodeFunctionData, parseUnits } from 'viem';
import { type Hash } from 'viem';
import faucetAbi from '@/lib/contracts/abis/Faucet.json';
import { contracts } from '@/lib/wagmi/config';

export function VerifierStakingInterface() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  const {
    stakedAmount,
    metrikBalance,
    currentTier,
    isLoading,
    error,
    stake,
    fetchStakedInfo,
  } = useStaking(address);
  
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('45'); // Default to 45 days
  const [isStaking, setIsStaking] = useState(false);
  const [mintAmount, setMintAmount] = useState('');
  const [isMinting, setIsMinting] = useState(false);

  const METRIK_ADDRESS = contracts.metrikToken.address as string;
  const FAUCET_ADDRESS = process.env.NEXT_PUBLIC_FAUCET_ADDRESS;

  // Refresh data when address changes
  useEffect(() => {
    if (address) {
      fetchStakedInfo();
    }
  }, [address, fetchStakedInfo]);

  const handleStake = async () => {
    if (!amount || !duration) {
      toast.error('Please enter amount and duration');
      return;
    }

    if (!address) {
      toast.error('Please connect your MetaMask wallet');
      return;
    }

    if (!walletClient || !publicClient) {
      toast.error('Wallet not connected. Please ensure MetaMask is connected.');
      return;
    }

    // Check if user has enough METRIK balance
    const requiredAmount = parseFloat(amount);
    const currentBalance = parseFloat(metrikBalance || '0');

    if (currentBalance < requiredAmount) {
      toast.error(
        `Insufficient METRIK balance! Required: ${requiredAmount} METRIK, Available: ${currentBalance} METRIK`
      );
      return;
    }

    setIsStaking(true);
    try {
      const durationInDays = parseInt(duration);
      await stake(amount, durationInDays);
      toast.success('Staking successful!');
      
      // Refresh data
      fetchStakedInfo();
      
      // Clear form
      setAmount('');
    } catch (err) {
      console.error('Staking error:', err);
      toast.error('Staking failed. Please try again.');
    } finally {
      setIsStaking(false);
    }
  };

  const handleMintMetrik = async () => {
    if (!mintAmount || parseFloat(mintAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!address) {
      toast.error('Please connect your MetaMask wallet');
      return;
    }

    if (!walletClient || !publicClient) {
      toast.error('Wallet not connected. Please ensure MetaMask is connected.');
      return;
    }

    // Validate addresses to avoid calling with missing "to"
    const isHexAddress = (v?: string) => !!v && /^0x[a-fA-F0-9]{40}$/.test(v);
    if (!isHexAddress(FAUCET_ADDRESS)) {
      toast.error('Faucet address is not configured. Set NEXT_PUBLIC_FAUCET_ADDRESS in your environment.');
      return;
    }
    if (!isHexAddress(METRIK_ADDRESS)) {
      toast.error('METRIK token address is not configured. Set NEXT_PUBLIC_METRIK_TOKEN_ADDRESS.');
      return;
    }

    const decimals = 18;
    const amt = BigInt(parseUnits(mintAmount, decimals).toString());
    setIsMinting(true);
    console.log('Minting METRIK...');
    try {
      // Ensure faucet is a contract on current chain
      const bytecode = await publicClient.getBytecode({ address: FAUCET_ADDRESS as `0x${string}` });
      if (!bytecode) {
        toast.error('Faucet contract not found on this network. Check NEXT_PUBLIC_FAUCET_ADDRESS and chain.');
        return;
      }

      // Preflight: ensure faucet is configured for METRIK and has enough balance
      try {
        const faucetMetrik = await publicClient.readContract({
          address: FAUCET_ADDRESS as `0x${string}`,
          abi: (faucetAbi as any).abi,
          functionName: 'metrik',
          args: [],
        });
        console.log('[Faucet preflight] faucet.metrik =', faucetMetrik);
        if ((faucetMetrik as string).toLowerCase() !== (METRIK_ADDRESS as string).toLowerCase()) {
          toast.error('Faucet is configured for a different METRIK token address.');
          return;
        }
        const faucetBalance = (await publicClient.readContract({
          address: METRIK_ADDRESS as `0x${string}`,
          abi: contracts.metrikToken.abi,
          functionName: 'balanceOf',
          args: [FAUCET_ADDRESS as `0x${string}`],
        })) as bigint;
        console.log('[Faucet preflight] faucet METRIK balance =', faucetBalance.toString());
        if (faucetBalance < amt) {
          const available = Number(faucetBalance) / 1e18;
          toast.error(`Faucet has insufficient balance. Available: ${available} METRIK`);
          return;
        }
      } catch (_) {
        // ignore; will revert with reason anyway
      }
      
      // Build calldata and submit directly to avoid provider eth_call quirks
      const data = encodeFunctionData({
        abi: (faucetAbi as any).abi,
        functionName: 'claim',
        args: [METRIK_ADDRESS as `0x${string}`, amt],
      });
      const hash = await walletClient.sendTransaction({
        to: FAUCET_ADDRESS as `0x${string}`,
        data: data as `0x${string}`,
        value: 0n,
      });
      
      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash });
      
      toast.success(`Minted ${mintAmount} METRIK to your wallet! Transaction: ${hash}`);
      
      // Refresh balance
      fetchStakedInfo();
      
      // Clear form
      setMintAmount('');
    } catch (err) {
      console.error('Minting error:', err);
      // Try to decode revert reason for clarity
      try {
        const result = await publicClient.call({
          account: address as `0x${string}`,
          to: FAUCET_ADDRESS as `0x${string}`,
          data: encodeFunctionData({ abi: (faucetAbi as any).abi, functionName: 'claim', args: [METRIK_ADDRESS as `0x${string}`, amt] }) as `0x${string}`,
        });
        console.log('[Faucet call raw] result =', result);
      } catch (inner) {
        console.error('[Faucet call raw] error =', inner);
      }
      toast.error('Minting failed. See console for details.');
    } finally {
      setIsMinting(false);
    }
  };

  const getTierName = (tier: number) => {
    switch (tier) {
      case 0: return 'None';
      case 1: return 'Bronze';
      case 2: return 'Silver';
      case 3: return 'Gold';
      case 4: return 'Diamond';
      default: return 'Unknown';
    }
  };

  const getTierColor = (tier: number) => {
    switch (tier) {
      case 0: return 'bg-gray-100 text-gray-800';
      case 1: return 'bg-amber-100 text-amber-800';
      case 2: return 'bg-gray-100 text-gray-800';
      case 3: return 'bg-yellow-100 text-yellow-800';
      case 4: return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!address) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connect MetaMask</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Please connect your MetaMask wallet to stake METRIK tokens and become a verifier.
          </p>
          <Button disabled className="w-full">
            Connect MetaMask First
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle>Current Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-gray-600">METRIK Balance</div>
              <div className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : metrikBalance || '0'}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-gray-600">Staked Amount</div>
              <div className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : stakedAmount || '0'}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-gray-600">Current Tier</div>
              <div className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : getTierName(currentTier)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staking Form */}
      <Card>
        <CardHeader>
          <CardTitle>Stake METRIK Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount to Stake (METRIK)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <Label htmlFor="duration">Staking Duration (Days)</Label>
              <select
                id="duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="45">45 Days (1% APY)</option>
                <option value="90">90 Days (2% APY)</option>
                <option value="180">180 Days (4% APY)</option>
                <option value="365">365 Days (8% APY)</option>
              </select>
            </div>

            <Button
              onClick={handleStake}
              disabled={isStaking || isLoading || !amount || !duration}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {isStaking ? 'Staking...' : 'Stake Tokens'}
            </Button>

            {error && (
              <div className="text-red-600 text-sm">
                Error: {error.message}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Staking Info */}
      <Card>
        <CardHeader>
          <CardTitle>Staking Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Connected Wallet:</span>
              <span className="font-mono text-gray-600">
                {address.slice(0, 8)}...{address.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Current Tier:</span>
              <span className={`px-2 py-1 rounded text-xs ${getTierColor(currentTier)}`}>
                {getTierName(currentTier)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Staked:</span>
              <span className="font-mono">{stakedAmount || '0'} METRIK</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mint METRIK Section */}
      <Card>
        <CardHeader>
          <CardTitle>Faucet: Mint METRIK Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="mintAmount">Amount to Mint (METRIK)</Label>
              <Input
                id="mintAmount"
                type="number"
                placeholder="Enter amount"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                min="0"
                step="0.01"
                disabled={isMinting}
              />
            </div>

            <Button
              onClick={handleMintMetrik}
              disabled={isMinting || !address || !mintAmount || parseFloat(mintAmount) <= 0}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isMinting ? 'Minting...' : 'Mint METRIK Tokens'}
            </Button>

            <p className="text-xs text-gray-500">
              You can mint any amount of METRIK tokens to your wallet for testing purposes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
