import { useState, useCallback, useEffect } from 'react';
import { useContract } from './useContract';
import { usePublicClient, useAccount } from 'wagmi';
import { formatAmount } from '@/lib/utils/contracts';
import { useAnimatedValue } from './useAnimatedValue';

export interface LPDeposit {
  amount: string;
  depositTime: Date;
  withdrawnAmount: string;
  interestAccrued: string;
  isActive: boolean;
}

export interface LPStats {
  totalDeposited: string;
  totalWithdrawn: string;
  totalInterest: string;
  activeDeposits: string;
}

export function useLPDepositHistory() {
  const { contract: lendingPoolContract } = useContract('lendingPool');
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const [deposits, setDeposits] = useState<LPDeposit[]>([]);
  const [lpStats, setLpStats] = useState<LPStats>({
    totalDeposited: '0',
    totalWithdrawn: '0',
    totalInterest: '0',
    activeDeposits: '0',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch LP deposit history
  const fetchLPDepositHistory = useCallback(async () => {
    if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi || !address) {
      setDeposits([]);
      setLpStats({
        totalDeposited: '0',
        totalWithdrawn: '0',
        totalInterest: '0',
        activeDeposits: '0',
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get user's total LP deposits
      const totalLPDeposits = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getUserTotalLPDeposits',
        args: [address],
      });

      // Get user's LP deposits
      const userLPDeposits = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getUserLPDeposits',
        args: [address],
      });

      // Create deposit history from the actual deposits
      const depositHistory: LPDeposit[] = [];
      
      if (Array.isArray(userLPDeposits)) {
        for (const deposit of userLPDeposits) {
          if (deposit && typeof deposit === 'object' && 'amount' in deposit) {
            const depositAmount = (Number(formatAmount(deposit.amount as bigint, 6))).toFixed(2); // MUSD has 6 decimals, format to 2 decimal places
            // Handle deposit time - if it's 0 or very small, use current time as fallback
            const depositTimeValue = Number(deposit.depositTime || 0);
            const depositTime = depositTimeValue > 1000000000 ? new Date(depositTimeValue * 1000) : new Date();
            const withdrawnAmount = (Number(formatAmount(deposit.withdrawnAmount || BigInt(0), 6))).toFixed(2);
            
            // Calculate interest for this specific deposit
            let interestAccrued = '0.00';
            
            // Handle missing withdrawnAmount - assume 0 for active deposits
            const depositWithdrawnAmount = deposit.withdrawnAmount || BigInt(0);
            const principal = Number(deposit.amount) - Number(depositWithdrawnAmount);
            
                          console.log('🔍 Interest Debug for deposit:', {
                depositAmount: deposit.amount,
                withdrawnAmount: depositWithdrawnAmount,
                principal: principal,
              lastClaimed: deposit.lastInterestClaimed ? Number(deposit.lastInterestClaimed) : 'undefined',
              currentTime: Math.floor(Date.now() / 1000),
              hasLastInterestClaimed: !!deposit.lastInterestClaimed,
              hasAmount: !!deposit.amount,
              hasWithdrawnAmount: !!deposit.withdrawnAmount
            });
            
            if (deposit.lastInterestClaimed && deposit.amount && principal > 0) {
              try {
                // Calculate interest using the contract's calculateInterest function
                const currentTime = Math.floor(Date.now() / 1000); // Current timestamp in seconds
                const lastClaimed = Number(deposit.lastInterestClaimed);
                
                if (lastClaimed > 0) {
                  const timeElapsed = currentTime - lastClaimed;
                  const timeInYears = timeElapsed / (365 * 24 * 60 * 60); // Convert to years
                  const interestRate = 800; // 8% APR (LP_INTEREST_RATE)
                  const basisPoints = 10000;
                  
                  // Calculate interest: principal * rate * timeInYears / BASIS_POINTS
                  const interest = (principal * interestRate * timeInYears) / basisPoints;
                  
                  // Try different calculation methods
                  const interestInUSDC = interest / 1e6; // Convert from wei to USDC
                  const interestFormatted = (Number(formatAmount(BigInt(Math.floor(interest)), 6))).toFixed(2);
                  const interestSimple = (interest / 1e6).toFixed(2); // Simple conversion
                  
                  console.log('🔍 Interest calculation:', {
                    interest: interest,
                    interestInUSDC: interestInUSDC,
                    interestFormatted: interestFormatted,
                    interestSimple: interestSimple,
                    timeElapsed: timeElapsed,
                    timeInYears: timeInYears
                  });
                  
                  // Use the simple calculation for now
                  interestAccrued = interestSimple;
                } else {
                  console.log('🔍 Interest calculation skipped - invalid lastClaimed:', lastClaimed);
                }
              } catch (error) {
                console.error('Error calculating interest for deposit:', error);
                interestAccrued = '0.00';
              }
            } else {
              console.log('🔍 Interest calculation skipped:', {
                principal: principal,
                principalValid: principal > 0,
                hasLastInterestClaimed: !!deposit.lastInterestClaimed,
                hasAmount: !!deposit.amount
              });
            }
            
            if (Number(depositAmount) > 0) {
              depositHistory.push({
                amount: depositAmount,
                depositTime: depositTime,
                withdrawnAmount: withdrawnAmount,
                interestAccrued: interestAccrued,
                isActive: Number(depositAmount) > Number(withdrawnAmount),
              });
            }
          }
        }
      }

      setDeposits(depositHistory);

      // Calculate stats
      const totalDeposited = depositHistory.reduce((sum, deposit) => sum + Number(deposit.amount), 0);
      const totalWithdrawn = depositHistory.reduce((sum, deposit) => sum + Number(deposit.withdrawnAmount), 0);
      const totalInterestEarned = depositHistory.reduce((sum, deposit) => sum + Number(deposit.interestAccrued), 0);
      const activeDeposits = depositHistory.filter(deposit => deposit.isActive).length;

      setLpStats({
        totalDeposited: totalDeposited.toFixed(2),
        totalWithdrawn: totalWithdrawn.toFixed(2),
        totalInterest: totalInterestEarned.toFixed(2),
        activeDeposits: activeDeposits.toString(),
      });

    } catch (err) {
      console.error('Error fetching LP deposit history:', err);
      setError(err as Error);
      setDeposits([]);
      setLpStats({
        totalDeposited: '0',
        totalWithdrawn: '0',
        totalInterest: '0',
        activeDeposits: '0',
      });
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi, address]);

  // Effect to fetch data on address change
  useEffect(() => {
    if (address) {
      fetchLPDepositHistory();

      const interval = setInterval(() => {
        fetchLPDepositHistory();
      }, 15000); // Refetch every 15 seconds

      return () => clearInterval(interval);
    }
  }, [address, fetchLPDepositHistory]);

  // Animated values for smooth UI updates
  const animatedStats = {
    totalDeposited: useAnimatedValue(lpStats.totalDeposited, 800, 'ease-out'),
    totalWithdrawn: useAnimatedValue(lpStats.totalWithdrawn, 800, 'ease-out'),
    totalInterest: useAnimatedValue(lpStats.totalInterest, 800, 'ease-out'),
    activeDeposits: useAnimatedValue(lpStats.activeDeposits, 800, 'ease-out'),
  };

  return {
    deposits,
    lpStats,
    animatedStats,
    isLoading,
    error,
    refetch: fetchLPDepositHistory,
  };
} 