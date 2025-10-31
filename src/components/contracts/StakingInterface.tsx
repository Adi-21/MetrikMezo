'use client';

import { useState, useEffect, useRef } from 'react';
import { useWallets, useCreateWallet, usePrivy } from '@privy-io/react-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStaking } from '@/hooks/useStaking';
import { useOneClickStaking } from '@/hooks/useOneClickStaking';
import { toast } from 'react-toastify';
import { keccak256, toUtf8Bytes } from 'ethers';
import Link from 'next/link';

export function StakingInterface() {
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { authenticated, ready } = usePrivy();
  
  // Find Privy embedded wallet
  const privyWallet = wallets.find(w => 
    w.walletClientType === 'privy' || 
    (w.meta && w.meta.id === 'io.privy.wallet') ||
    w.connectorType === 'embedded'
  );
  const address = privyWallet?.address;
  
  const {
    unstake,
    getActiveStakes,
    currentTier,
    stakeDuration,
    isLoading,
    error,
    animatedStakedAmount,
    animatedMetrikBalance,
  } = useStaking(address);
  
  // One-click staking hook
  const { executeOneClickStake, isExecuting } = useOneClickStaking(wallets);
  
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('45'); // Default to 45 days
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [isGrantingRole, setIsGrantingRole] = useState(false);
  const [minterRoleTxHash, setMinterRoleTxHash] = useState<string>('');
  const walletCreationAttempted = useRef(false);

  // Auto-grant minter role function
  const autoGrantMinterRole = async () => {
    if (!address) {
      console.log('❌ No address available for granting minter role');
      return;
    }

    try {
      setIsGrantingRole(true);
      console.log('🔐 Auto-granting minter role to:', address);
      
      const MINTER_ROLE = keccak256(toUtf8Bytes("MINTER_ROLE"));
      
      const res = await fetch('/api/grant-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: MINTER_ROLE, address }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        console.log('✅ Minter role granted automatically! Tx:', data.txHash);
        setMinterRoleTxHash(data.txHash);
        toast.success('🎉 Minter role granted automatically!', {
          autoClose: 5000,
          onClick: () => {
            if (data.txHash) {
              window.open(`https://explorer.test.mezo.org/tx/${data.txHash}`, '_blank');
            }
          }
        });
      } else {
        console.log('⚠️ Auto-grant minter role failed:', data.error);
        toast.error('Failed to grant minter role automatically');
      }
    } catch (error) {
      console.error('❌ Auto-grant minter role error:', error);
      toast.error('Failed to grant minter role automatically');
    } finally {
      setIsGrantingRole(false);
    }
  };

  // Auto-create wallet if user is authenticated but has no wallets
  useEffect(() => {
    const createWalletIfNeeded = async () => {
      // More robust check - don't create if we already have an address or if wallets exist
      const hasWallets = wallets.length > 0;
      const hasAddress = !!address;
      const shouldCreateWallet = ready && authenticated && !hasAddress && !hasWallets && !isCreatingWallet && !walletCreationAttempted.current;
      
      console.log('📊 Wallet creation check:', {
        ready,
        authenticated,
        hasAddress,
        hasWallets,
        walletsLength: wallets.length,
        isCreatingWallet,
        shouldCreateWallet
      });
      
      if (shouldCreateWallet) {
        console.log('🔄 No wallets found, creating embedded wallet...');
        
        walletCreationAttempted.current = true;
        setIsCreatingWallet(true);
        try {
          await createWallet();
          console.log('✅ Embedded wallet created successfully');
        } catch (error) {
          console.error('❌ Failed to create wallet:', error);
          // If error is about already having a wallet, that's actually fine
          if (error instanceof Error && error.message.includes('already has an embedded wallet')) {
            console.log('✅ Wallet already exists - this is expected');
            // Don't treat this as an error, just log it
          } else {
            // Only show error toast for actual errors
            toast.error('Failed to create wallet. Please try again.');
          }
        } finally {
          setIsCreatingWallet(false);
        }
      } else {
        console.log('📝 Wallet creation skipped:', {
          ready,
          authenticated,
          hasAddress,
          hasWallets,
          walletsLength: wallets.length,
          isCreatingWallet
        });
      }
    };

    createWalletIfNeeded();
  }, [ready, authenticated, address, wallets.length, createWallet, isCreatingWallet]);

  // Reset wallet creation attempt when user changes
  useEffect(() => {
    if (!authenticated) {
      walletCreationAttempted.current = false;
    }
  }, [authenticated]);

  // Debug wallet state changes
  useEffect(() => {
    console.log('🔄 StakingInterface wallet state changed:', {
      walletsLength: wallets?.length || 0,
      wallets: wallets?.map(w => ({
        address: w.address,
        type: w.walletClientType,
        connectorType: w.connectorType
      })) || [],
      privyWallet: !!privyWallet,
      address
    });
  }, [wallets, privyWallet, address]);

  // One-click staking handler
  const handleOneClickStake = async () => {
    if (!amount || !duration) {
      toast.error('Please enter amount and duration');
      return;
    }

            // Check if user has enough METRIK balance
        const requiredAmount = parseFloat(amount);
        const currentBalance = parseFloat(String(animatedMetrikBalance));
    
    if (currentBalance < requiredAmount) {
      toast.error(
        `❌ Insufficient METRIK balance! 
        💰 Required: ${requiredAmount} METRIK
        💰 Available: ${currentBalance} METRIK
        💡 Go to Home page to claim more tokens from faucet`,
        { autoClose: 8000 }
      );
      return;
    }

    try {
      console.log('🚀 Initiating one-click stake:', { amount, duration });
      
      const result = await executeOneClickStake(amount, duration);
      
      if (result?.success) {
        console.log('✅ One-click staking successful!', result);
        
        // Clear form on success
        setAmount('');
        setDuration('45'); // Reset to default instead of clearing
        
        // Show success message with transaction details
        toast.success(`🎉 One-click staking completed successfully!`, {
          autoClose: 8000,
          onClick: () => {
            if (result.stakingHash) {
              window.open(`https://explorer.test.mezo.org/tx/${result.stakingHash}`, '_blank');
            }
          }
        });
        
        // Auto-grant minter role after successful staking
        console.log('🔐 Auto-granting minter role after successful staking...');
        setTimeout(() => {
          autoGrantMinterRole();
        }, 2000); // Wait 2 seconds after staking success
      }
    } catch (error) {
      console.error('❌ One-click staking error:', error);
      toast.error('One-click staking failed. Please try again.');
    }
  };

  const handleUnstake = async () => {
    try {
      setIsUnstaking(true);
      
      // Get active stakes to find the first valid stake index
      const activeStakes = await getActiveStakes(address);
      console.log('🔍 handleUnstake: Active stakes:', activeStakes);
      
      if (activeStakes.length === 0) {
        toast.error('No active stakes found to unstake.');
        return;
      }
      
      // Find the first stake with amount > 0
      const validStakeIndex = activeStakes.findIndex(stake => stake.amount > 0n);
      
      if (validStakeIndex === -1) {
        toast.error('No valid stakes found to unstake.');
        return;
      }
      
      // Check if the stake has reached its duration
      const stake = activeStakes[validStakeIndex];
      const currentTime = Math.floor(Date.now() / 1000);
      const stakeEndTime = Number(stake.startTime) + Number(stake.duration);
      const timeRemaining = stakeEndTime - currentTime;
      
      console.log('🔍 handleUnstake: Stake details:', {
        startTime: new Date(Number(stake.startTime) * 1000),
        duration: Number(stake.duration),
        endTime: new Date(stakeEndTime * 1000),
        currentTime: new Date(currentTime * 1000),
        timeRemaining: timeRemaining / (24 * 60 * 60), // in days
        canUnstake: timeRemaining <= 0
      });
      
      if (timeRemaining > 0) {
        const daysRemaining = Math.ceil(timeRemaining / (24 * 60 * 60));
        toast.error(`Cannot unstake yet! Staking period ends in ${daysRemaining} days.`);
        return;
      }
      
      console.log('🔍 handleUnstake: Unstaking stake at index:', validStakeIndex);
      await unstake(validStakeIndex);
      
      toast.success('Unstake successful! Your tokens have been returned.');
    } catch (err) {
      console.error('Unstaking error:', err);
      
      // Check for specific error messages
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('StakingPeriodNotEnded')) {
        toast.error('Cannot unstake yet! Your staking period has not ended.');
      } else if (errorMessage.includes('NoStakeFound')) {
        toast.error('No stake found at the specified index.');
      } else if (errorMessage.includes('Invalid stake index')) {
        toast.error('Invalid stake index. Please try again.');
      } else {
        toast.error('Failed to unstake. Please try again.');
      }
    } finally {
      setIsUnstaking(false);
    }
  };

  const getTierName = (tier: number) => {
    const names = ['None', 'Diamond', 'Gold', 'Silver', 'Bronze'];
    return names[tier] || 'Unknown';
  };

  const getTierColor = (tier: number) => {
    const colors = ['text-gray-600', 'text-orange-600', 'text-gray-600', 'text-yellow-600', 'text-purple-600'];
    return colors[tier] || 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Centered Transaction Loader */}
      {isExecuting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-xl max-w-md mx-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  ⚡ Processing Seamless Staking
                </h3>
                <p className="text-sm text-gray-600">
                  Please wait while we complete your staking transaction...
                </p>
                <div className="mt-4 space-y-2 text-xs text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Step 1: Approving METRIK tokens</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span>Step 2: Staking tokens (in progress)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Centered Minter Role Loader */}
      {isGrantingRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-xl max-w-md mx-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  🔐 Granting Minter Role
                </h3>
                <p className="text-sm text-gray-600">
                  Please wait while we grant you the minter role...
                </p>
                <div className="mt-4 space-y-2 text-xs text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                    <span>Processing minter role request...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Minter Role Success Modal */}
      {minterRoleTxHash && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-xl max-w-md mx-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  ✅ Minter Role Granted Successfully!
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  You can now create invoices and mint NFTs.
                </p>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Transaction Hash:</p>
                  <p className="text-xs font-mono text-gray-800 break-all">
                    {minterRoleTxHash}
                  </p>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => {
                      window.open(`https://explorer.test.mezo.org/tx/${minterRoleTxHash}`, '_blank');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
                    size="sm"
                  >
                    🔍 View on Explorer
                  </Button>
                  <Button
                    onClick={() => setMinterRoleTxHash('')}
                    className="bg-gray-600 hover:bg-gray-700 text-white text-sm"
                    size="sm"
                  >
                    ✕ Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Wallet Status */}
      {isCreatingWallet && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Creating Wallet</h3>
              <div className="mt-1 text-sm text-blue-700">Please wait while we create your embedded wallet...</div>
            </div>
          </div>
        </div>
      )}



      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error.message}</div>
            </div>
          </div>
        </div>
      )}



      {/* Staking Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900">Current Stake</h3>
          <div className="flex items-center">
            <p className="text-2xl font-bold text-indigo-600 transition-all duration-300">
              {animatedStakedAmount} METRIK
            </p>
            {isLoading && (
              <div className="ml-2 w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
          <p className="text-sm text-gray-500">Duration: {stakeDuration ? (stakeDuration / (24 * 60 * 60)) : 0} days</p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900">METRIK Balance</h3>
          <div className="flex items-center">
            <p className="text-2xl font-bold text-green-600 transition-all duration-300">
              {animatedMetrikBalance} METRIK
            </p>
            {isLoading && (
              <div className="ml-2 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
          <p className="text-sm text-gray-500">Available for staking</p>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900">Current Tier</h3>
          <div className="flex items-center">
            <p className={`text-2xl font-bold ${getTierColor(currentTier || 0)}`}>
              {getTierName(currentTier || 0)}
            </p>
            {isLoading && (
              <div className="ml-2 w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
          <p className="text-sm text-gray-500">Tier {currentTier || 0} based on staked amount</p>
        </div>
      </div>

      {/* Staking Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Stake METRIK</span>
            <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full font-normal">
              ⚡ Zero-Click Available
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* One-Click Benefits Info */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
            <h4 className="text-sm font-semibold text-green-900 mb-2">⚡ Why Use Seamless Staking?</h4>
            <ul className="text-xs text-green-800 space-y-1">
              <li>• <strong>Zero-Click:</strong> No wallet confirmations or prompts</li>
              <li>• <strong>Instant:</strong> Backend handles all approvals automatically</li>
              <li>• <strong>Seamless:</strong> Approval + staking in complete background</li>
              <li>• <strong>Perfect UX:</strong> Users don&apos;t need to understand blockchain complexity</li>
            </ul>
          </div>


          
          {/* Seamless Execution Progress */}
          {isExecuting && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-lg border border-amber-200">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-amber-900">⚡ Seamless Execution in Progress</h4>
                  <p className="text-xs text-amber-800 mt-1">
                    Running approval + staking in background... No action needed from you!
                  </p>
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-amber-700">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Step 1: Approval transaction submitted</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-amber-700">
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                      <span>Step 2: Waiting for blockchain confirmation (~8 seconds)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-amber-600">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <span>Step 3: Staking transaction (pending)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount to Stake</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                                       disabled={isExecuting}
              />
              {amount && parseFloat(amount) > parseFloat(String(animatedMetrikBalance)) && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  ⚠️ Insufficient balance! You have {animatedMetrikBalance} METRIK available.
                  <br />
                  <Link href="/" className="text-red-800 underline font-medium">
                    → Go to Home page to claim more tokens
                  </Link>
                </div>
              )}
            </div>
            
            <div>
              <Label htmlFor="duration">Duration (days)</Label>
              <select
                id="duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={isExecuting}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="45">45 days (Standard)</option>
                <option value="90">90 days (Extended)</option>
                <option value="180">180 days (Long-term) ⭐ 2x Points</option>
                <option value="365">365 days (Maximum) ⭐ 2x Points</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                ⭐ 180+ days get 2x points multiplier
              </p>
            </div>
            
            {/* One-Click Staking (Primary Method) */}
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                <h4 className="text-sm font-semibold text-green-900 mb-2">🚀 Seamless Staking (Zero-Click Experience)</h4>
                <p className="text-xs text-green-700 mb-3">
                  ✨ Completely automated! Approval + staking happens in background with ZERO wallet prompts!
                </p>

                
                <Button
                  onClick={handleOneClickStake}
                  disabled={
                    isExecuting || 
                    isCreatingWallet || 
                    !amount || 
                    !duration || 
                    !authenticated || 
                    (!privyWallet && !isCreatingWallet)
                  }
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold"
                  size="lg"
                >
                  {isExecuting 
                    ? '⚡ Processing Seamlessly...' 
                    : isCreatingWallet 
                      ? 'Creating Wallet...' 
                      : !authenticated 
                        ? 'Please Login First'
                        : !privyWallet 
                          ? 'Wallet Required'
                          : `⚡ SEAMLESS STAKE ${amount ? `${amount} METRIK` : ''} (Zero-Click)`
                  }
                </Button>
              </div>


            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unstaking Form */}
      <Card>
        <CardHeader>
          <CardTitle>Unstake METRIK</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleUnstake}
            disabled={isUnstaking}
            variant="outline"
            className="w-full"
          >
            {isUnstaking ? 'Unstaking...' : 'Unstake All'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
} 