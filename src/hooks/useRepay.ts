import { useState, useCallback, useEffect } from 'react';
import { useContract } from './useContract';
import { usePublicClient, useAccount, useWalletClient } from 'wagmi';
import { parseAmount, formatAmount } from '@/lib/utils/contracts';
import { toast } from 'react-toastify';
import { useAnimatedValue } from './useAnimatedValue';
import { useWallets, useSendTransaction } from '@privy-io/react-auth';
import { encodeFunctionData } from 'viem';
import { useSeamlessTransaction } from './useSeamlessTransaction';

export interface RepaymentLoan {
  invoiceId: string;
  amount: string;
  dueDate: Date;
  isRepaid: boolean;
  isLiquidated: boolean;
  interestAccrued: string;
  totalAmount: string;
  daysUntilDue: number;
  isOverdue: boolean;
}

export interface RepaymentStats {
  totalOutstanding: string;
  totalInterest: string;
  overdueLoans: string;
  activeLoans: string;
  totalRepaid: string;
}

export function useRepay(addressOverride?: string) {
  const { contract: lendingPoolContract } = useContract('lendingPool');
  const { contract: musdContract } = useContract('musd'); // Changed from usdc to musd
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { address: wagmiAddress } = useAccount();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const { executeBatchTransactions } = useSeamlessTransaction();
  const privyWallet = wallets.find(w => w.walletClientType === 'privy' || (w.meta && w.meta.id === 'io.privy.wallet'));
  const isPrivy = !!(addressOverride || privyWallet?.address);
  const address = addressOverride || privyWallet?.address || wagmiAddress;

  const [outstandingLoans, setOutstandingLoans] = useState<RepaymentLoan[]>([]);
  const [repaymentStats, setRepaymentStats] = useState<RepaymentStats>({
    totalOutstanding: '0',
    totalInterest: '0',
    overdueLoans: '0',
    activeLoans: '0',
    totalRepaid: '0',
  });
  const [musdBalance, setMusdBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Animated values for smooth UI updates
  const animatedStats = {
    totalOutstanding: useAnimatedValue(repaymentStats.totalOutstanding, 800, 'ease-out'),
    totalInterest: useAnimatedValue(repaymentStats.totalInterest, 800, 'ease-out'),
    overdueLoans: useAnimatedValue(repaymentStats.overdueLoans, 800, 'ease-out'),
    activeLoans: useAnimatedValue(repaymentStats.activeLoans, 800, 'ease-out'),
    totalRepaid: useAnimatedValue(repaymentStats.totalRepaid, 800, 'ease-out'),
  };
  const animatedMusdBalance = useAnimatedValue(musdBalance, 800, 'ease-out');

  const fetchOutstandingLoans = useCallback(async () => {
    if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi || !address) {
      setOutstandingLoans([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get user's active loan IDs
      let loanIds: bigint[] = [];
      try {
        loanIds = await publicClient.readContract({
          address: lendingPoolContract.address,
          abi: lendingPoolContract.abi,
          functionName: 'getUserActiveLoans',
          args: [address],
        }) as bigint[];
      } catch (err) {
        // If getUserActiveLoans fails, try getUserLoans
        try {
          loanIds = await publicClient.readContract({
            address: lendingPoolContract.address,
            abi: lendingPoolContract.abi,
            functionName: 'getUserLoans',
            args: [address],
          }) as bigint[];
        } catch (err2) {
          loanIds = [];
        }
      }

      // Filter out invalid loan IDs
      const validLoanIds = loanIds
        .map(id => id.toString())
        .filter(id => id !== '' && id !== 'undefined');
    

      // If no loans found from contract functions, try manual search
      if (validLoanIds.length === 0) {
        
        // Try common invoice IDs that might have loans
        const possibleInvoiceIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
        
        for (const invoiceId of possibleInvoiceIds) {
          try {
            const loanDetails = await publicClient.readContract({
              address: lendingPoolContract.address,
              abi: lendingPoolContract.abi,
              functionName: 'getUserLoanDetails',
              args: [address, BigInt(invoiceId)],
            }) as any;
            
            // Check if this is an active loan (not repaid, not liquidated, has amount)
            if (loanDetails && 
                loanDetails[0] && loanDetails[0] > BigInt(0) && // has amount
                !loanDetails[2] && // not repaid
                !loanDetails[3]) { // not liquidated
              validLoanIds.push(invoiceId);
            }
          } catch (err) {
            // Ignore errors for non-existent loans
          }
        }
      
      }

      // Fetch details for each loan
      const loans: RepaymentLoan[] = [];
      let totalOutstanding = BigInt(0);
      let totalInterest = BigInt(0);
      let overdueCount = 0;
      let activeCount = 0;

      for (const loanId of validLoanIds) {
        try {
          const loanDetails = await publicClient.readContract({
            address: lendingPoolContract.address,
            abi: lendingPoolContract.abi,
            functionName: 'getUserLoanDetails',
            args: [address, BigInt(loanId)],
          }) as [bigint, bigint, boolean, boolean, bigint];

          if (loanDetails) {
            const [amount, dueDate, isRepaid, isLiquidated, interestAccrued] = loanDetails;
            const currentTime = BigInt(Math.floor(Date.now() / 1000));
            const isOverdue = currentTime > dueDate && !isRepaid && !isLiquidated;
            const daysUntilDue = isOverdue ? 0 : Math.max(0, Math.floor(Number(dueDate - currentTime) / (24 * 60 * 60)));

            const loan: RepaymentLoan = {
              invoiceId: loanId,
              amount: amount.toString(),
              dueDate: new Date(Number(dueDate) * 1000),
              isRepaid,
              isLiquidated,
              interestAccrued: interestAccrued.toString(),
              totalAmount: (amount + interestAccrued).toString(),
              daysUntilDue,
              isOverdue,
            };

            loans.push(loan);
            
            if (!isRepaid && !isLiquidated) {
              totalOutstanding += amount + interestAccrued;
              totalInterest += interestAccrued;
              activeCount++;
              
              if (isOverdue) {
                overdueCount++;
              }
            }
          }
        } catch (err) {
          console.error('Error fetching loan details for ID:', loanId, err);
        }
      }
      setOutstandingLoans(loans);

      // Update stats
      setRepaymentStats({
        totalOutstanding: totalOutstanding.toString(),
        totalInterest: totalInterest.toString(),
        overdueLoans: overdueCount.toString(),
        activeLoans: activeCount.toString(),
        totalRepaid: '0', // This would be calculated from historical data
      });
    } catch (err) {
      console.error('Error fetching outstanding loans:', err);
      setError(err as Error);
      setOutstandingLoans([]);
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi, address]);

  const fetchMusdBalance = useCallback(async () => {
    if (!publicClient || !musdContract.address || !musdContract.abi || !address) {
      setMusdBalance('0');
      return;
    }

    try {
      const balance = await publicClient.readContract({
        address: musdContract.address,
        abi: musdContract.abi,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;

      setMusdBalance(balance.toString());
    } catch (err) {
      console.error('Error fetching MUSD balance:', err);
      setMusdBalance('0');
    }
  }, [publicClient, musdContract.address, musdContract.abi, address]);

  const getLoanDetails = useCallback(async (invoiceId: string) => {
    try {
      if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi) {
        return null;
      }

      const loanDetails = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getUserLoanDetails',
        args: [address!, BigInt(invoiceId)],
      }) as [bigint, bigint, boolean, boolean, bigint];

      if (loanDetails) {
        const [amount, dueDate, isRepaid, isLiquidated, interestAccrued] = loanDetails;
        const currentTime = BigInt(Math.floor(Date.now() / 1000));
        const isOverdue = currentTime > dueDate && !isRepaid && !isLiquidated;
        const daysUntilDue = isOverdue ? 0 : Math.max(0, Math.floor(Number(dueDate - currentTime) / (24 * 60 * 60)));

        return {
          invoiceId,
          amount: amount.toString(),
          dueDate: new Date(Number(dueDate) * 1000),
          isRepaid,
          isLiquidated,
          interestAccrued: interestAccrued.toString(),
          totalAmount: (amount + interestAccrued).toString(),
          daysUntilDue,
          isOverdue,
        };
      }
      return null;
    } catch (err) {
      console.error('Error getting loan details:', err);
      return null;
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi, address]);

  const repay = useCallback(async (invoiceId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (isPrivy) {
        // Use seamless batch transactions for suppliers
        const loanDetails = await getLoanDetails(invoiceId);
        if (!loanDetails) {
          throw new Error('Loan not found or not active.');
        }
        const requiredAmount = parseAmount(loanDetails.totalAmount, 6);
        
        // Execute approve and repay in one seamless batch
        const transactions = [
          {
            to: musdContract.address,
            data: encodeFunctionData({
              abi: musdContract.abi,
              functionName: 'approve',
              args: [lendingPoolContract.address, requiredAmount],
            }),
          },
          {
            to: lendingPoolContract.address,
            data: encodeFunctionData({
              abi: lendingPoolContract.abi,
              functionName: 'repay',
              args: [BigInt(invoiceId)],
            }),
          },
        ];

        const results = await executeBatchTransactions(transactions, publicClient?.chain.id);
        await fetchOutstandingLoans();
        await fetchMusdBalance();
        toast.success('Repayment successful!');
        return results[1].hash; // Return the repay transaction hash
      }
      if (!walletClient || !address || !publicClient) {
        throw new Error('Wallet client, address, or public client not available.');
      }

      // Get loan details to calculate total amount to repay
      const loanDetails = await getLoanDetails(invoiceId);
      if (!loanDetails) {
        throw new Error('Loan not found or not active.');
      }

      // Check if user has enough MUSD balance
      const requiredAmount = parseAmount(loanDetails.totalAmount, 6);
      const currentBalance = parseAmount(musdBalance, 6);
      
      if (requiredAmount > currentBalance) {
        throw new Error(`Insufficient MUSD balance. You need ${loanDetails.totalAmount} but have ${musdBalance}.`);
      }

      // First approve the lending pool to spend MUSD
      const { request: approveRequest } = await publicClient.simulateContract({
        account: address as `0x${string}`,
        address: musdContract.address,
        abi: musdContract.abi,
        functionName: 'approve',
        args: [lendingPoolContract.address, requiredAmount],
      });

      const approveHash = await walletClient.writeContract(approveRequest);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Then repay the loan
      const { request: repayRequest } = await publicClient.simulateContract({
        account: address as `0x${string}`,
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'repay',
        args: [BigInt(invoiceId)],
      });

      const repayHash = await walletClient.writeContract(repayRequest);
      await publicClient.waitForTransactionReceipt({ hash: repayHash });

      // Refresh data
      await fetchOutstandingLoans();
      await fetchMusdBalance();

      toast.success('Repayment successful!');
      return repayHash;
    } catch (err) {
      console.error('Error repaying loan:', err);
      setError(err as Error);
      toast.error('Repayment failed. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address, publicClient, lendingPoolContract.address, lendingPoolContract.abi, musdContract.address, musdContract.abi, getLoanDetails, musdBalance, fetchOutstandingLoans, fetchMusdBalance, isPrivy, sendTransaction, executeBatchTransactions]);

  const calculateInterest = useCallback(async (principal: string, startTime: Date) => {
    try {
      if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi) {
        return '0';
      }

      const principalBigInt = parseAmount(principal, 6);
      const startTimeBigInt = BigInt(Math.floor(startTime.getTime() / 1000));
      const currentTime = BigInt(Math.floor(Date.now() / 1000));

      const interest = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'calculateInterest',
        args: [principalBigInt, startTimeBigInt, BigInt(1000)], // 10% APR
      }) as bigint;

      return formatAmount(interest);
    } catch (err) {
      console.error('Error calculating interest:', err);
      return '0';
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi]);

  // Effect to fetch data on address change or periodically
  useEffect(() => {
    if (address) {
      fetchOutstandingLoans();
      fetchMusdBalance();

      const interval = setInterval(() => {
        fetchOutstandingLoans();
        fetchMusdBalance();
      }, 30000); // Refetch every 30 seconds

      return () => clearInterval(interval);
    }
  }, [address, fetchOutstandingLoans, fetchMusdBalance]);

  return {
    outstandingLoans,
    repaymentStats,
    musdBalance,
    isLoading,
    error,
    repay,
    getLoanDetails,
    calculateInterest,
    refetch: () => {
      if (address) {
        fetchOutstandingLoans();
        fetchMusdBalance();
      }
    },
    // Animated values for smooth UI updates
    animatedStats,
    animatedMusdBalance,
  };
} 