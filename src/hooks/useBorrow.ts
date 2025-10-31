import { useState, useCallback, useEffect } from 'react';
import { useContract } from './useContract';
import { usePublicClient, useAccount, useWalletClient } from 'wagmi';
import { parseAmount, formatAmount } from '@/lib/utils/contracts';
import { toast } from 'react-toastify';
import { useAnimatedValue } from './useAnimatedValue';
import { useWallets, useSendTransaction } from '@privy-io/react-auth';
import { encodeFunctionData } from 'viem';
import { useSeamlessTransaction } from './useSeamlessTransaction';

export interface Loan {
  invoiceId: string;
  amount: string;
  dueDate: Date;
  status: 'active' | 'repaid' | 'liquidated';
  interestAccrued: string;
  borrowTime: Date;
  supplier: string;
  borrowAmount: string;
}

export interface BorrowStats {
  totalLoans: number;
  activeLoans: number;
  repaidLoans: number;
  liquidatedLoans: number;
  totalBorrowed: number;
  totalInterest: number;
  totalRepaid: number;
}

export function useBorrow(addressOverride?: string) {
  const { contract: lendingPoolContract } = useContract('lendingPool');
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { address: wagmiAddress } = useAccount();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const { executeBatchTransactions } = useSeamlessTransaction();
  const privyWallet = wallets.find(w => w.walletClientType === 'privy' || (w.meta && w.meta.id === 'io.privy.wallet'));
  const isPrivy = !!(addressOverride || privyWallet?.address);
  const address = addressOverride || privyWallet?.address || wagmiAddress;
  const readClient = publicClient;

  const [userLoans, setUserLoans] = useState<Loan[]>([]); // All loans (history)
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]); // Only active loans
  const [borrowStats, setBorrowStats] = useState<BorrowStats>({
    totalLoans: 0,
    activeLoans: 0,
    repaidLoans: 0,
    liquidatedLoans: 0,
    totalBorrowed: 0,
    totalInterest: 0,
    totalRepaid: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // New state for borrowing capacity and safe lending amount
  const [borrowingCapacity, setBorrowingCapacity] = useState<string>('0');
  const [safeLendingAmount, setSafeLendingAmount] = useState<string>('0'); // New state for safe lending amount

  // Animated values for smooth UI updates
  const animatedStats = {
    totalBorrowed: useAnimatedValue(borrowStats.totalBorrowed.toString(), 800, 'ease-out'),
    activeLoans: useAnimatedValue(borrowStats.activeLoans.toString(), 800, 'ease-out'),
    repaidLoans: useAnimatedValue(borrowStats.repaidLoans.toString(), 800, 'ease-out'),
    liquidatedLoans: useAnimatedValue(borrowStats.liquidatedLoans.toString(), 800, 'ease-out'),
    totalInterest: useAnimatedValue(borrowStats.totalInterest.toString(), 800, 'ease-out'),
    totalLoans: useAnimatedValue(borrowStats.totalLoans.toString(), 800, 'ease-out'),
  };

  // New function to get borrowing capacity
  const getBorrowingCapacity = useCallback(async (userAddress?: string): Promise<string> => {
    if (!readClient || !lendingPoolContract.address || !lendingPoolContract.abi || !address) {
      setError('Borrowing capacity: missing address or contract.');
      return '0';
    }

    try {
      const capacity = await readClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getBorrowingCapacity',
        args: [userAddress || address || '0x0'],
      }) as bigint;
      
      console.log('🔍 Raw borrowing capacity from contract:', capacity);
      // Format with 6 decimals for USDC
      const formattedCapacity = formatAmount(capacity, 6);
      console.log('🔍 Formatted borrowing capacity:', formattedCapacity);
      
      return formattedCapacity;
    } catch (err) {
      console.error('Error fetching borrowing capacity:', err);
      return '0';
    }
  }, [readClient, lendingPoolContract.address, lendingPoolContract.abi, address]);

  // New function to get system-wide safe lending amount
  const getSystemWideSafeLendingAmount = useCallback(async (): Promise<string> => {
    if (!readClient || !lendingPoolContract.address || !lendingPoolContract.abi) {
      console.error('Safe lending amount: missing contract.');
      return '0';
    }

    try {
      console.log('🔍 Fetching system-wide safe lending amount from contract...');
      
      const safeAmount = await readClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getSystemWideSafeLendingAmount',
      });
      
      console.log('🔍 Raw safe lending amount from contract:', safeAmount);
      const formattedAmount = formatAmount(safeAmount as bigint, 6); // USDC has 6 decimals
      console.log('🔍 Formatted safe lending amount:', formattedAmount);
      
      return formattedAmount;
    } catch (err) {
      console.error('Error fetching system-wide safe lending amount:', err);
      return '0';
    }
  }, [readClient, lendingPoolContract.address, lendingPoolContract.abi]);

  // Fetch system-wide safe lending amount on mount
  useEffect(() => {
    (async () => {
      const safeAmount = await getSystemWideSafeLendingAmount();
      setSafeLendingAmount(safeAmount); // This state variable was removed
    })();
  }, [getSystemWideSafeLendingAmount]);

  // Fetch all user loan IDs (history)
  const getAllUserLoans = useCallback(async (): Promise<Loan[]> => {
    if (!readClient || !lendingPoolContract.address || !lendingPoolContract.abi || !address) {
      setError('User loans: missing address or contract.');
      return [];
    }
    try {
      const loanIds = await readClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getUserLoans',
        args: [address],
      }) as bigint[];
      if (!loanIds || loanIds.length === 0) return [];
      const loanResults = await Promise.all(
        loanIds.map(async (id) => {
          try {
            // Use the raw loans(id) function instead of getUserLoanDetails
            const details = await readClient.readContract({
              address: lendingPoolContract.address,
              abi: lendingPoolContract.abi,
              functionName: 'loans',
              args: [id],
            }) as any;
            if (!details || typeof details[0] === 'undefined') return null;
            // details: [invoiceId, amount, dueDate, isRepaid, isLiquidated, interestAccrued, lastInterestUpdate, supplier, borrowAmount, borrowTime]
            const amount = formatAmount(details[1], 6);
            const dueDate = new Date(Number(details[2]) * 1000);
            const isRepaid = details[3];
            const isLiquidated = details[4];
            const interestAccrued = formatAmount(details[5], 6);
            const borrowTime = new Date(Number(details[9]) * 1000);
            let status: 'active' | 'repaid' | 'liquidated' = 'active';
            if (isRepaid) status = 'repaid';
            if (isLiquidated) status = 'liquidated';
            return {
              invoiceId: id.toString(),
              amount,
              dueDate,
              status,
              interestAccrued,
              borrowTime,
              supplier: details[7],
              borrowAmount: formatAmount(details[8], 6),
            };
          } catch (err: any) {
            return null;
          }
        })
      );
      const loans: Loan[] = loanResults.filter((loan): loan is Loan => loan !== null);
      return loans;
    } catch (err) {
      return [];
    }
  }, [readClient, lendingPoolContract.address, lendingPoolContract.abi, address]);

  // Fetch only active user loan IDs
  const getActiveUserLoans = useCallback(async (): Promise<Loan[]> => {
    if (!readClient || !lendingPoolContract.address || !lendingPoolContract.abi || !address) {
      setError('Active user loans: missing address or contract.');
      return [];
    }
    try {
      const loanIds = await readClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getUserActiveLoans',
        args: [address],
      }) as bigint[];
      if (!loanIds || loanIds.length === 0) return [];
      const loanResults = await Promise.all(
        loanIds.map(async (id) => {
          try {
            const details = await readClient.readContract({
              address: lendingPoolContract.address,
              abi: lendingPoolContract.abi,
              functionName: 'getUserLoanDetails',
              args: [address, id],
            }) as any;
            if (!details || typeof details[0] === 'undefined') return null;
            const amount = formatAmount(details[0], 6);
            const dueDate = new Date(Number(details[1]) * 1000);
            const isRepaid = details[2];
            const isLiquidated = details[3];
            const interestAccrued = formatAmount(details[4], 6);
            let status: 'active' | 'repaid' | 'liquidated' = 'active';
            if (isRepaid) status = 'repaid';
            if (isLiquidated) status = 'liquidated';
            const borrowTime = new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000);
            return {
              invoiceId: id.toString(),
              amount,
              dueDate,
              status,
              interestAccrued,
              borrowTime,
              supplier: '',
              borrowAmount: amount,
            };
          } catch (err: any) {
            if (err.message && err.message.includes('Loan not found or not active')) {
              return null;
            }
            return null;
          }
        })
      );
      const loans: Loan[] = loanResults.filter((loan): loan is Loan => loan !== null);
      return loans;
    } catch (err) {
      return [];
    }
  }, [readClient, lendingPoolContract.address, lendingPoolContract.abi, address]);

  const getUserLoansRaw = useCallback(async (userAddress?: string) => {
    if (!readClient || !lendingPoolContract.address || !lendingPoolContract.abi || !address) {
      setError('User loans raw: missing address or contract.');
      return [];
    }
    try {
      const ids = await readClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getUserLoans',
        args: [userAddress || address || '0x0'],
      });
      return ids;
    } catch (err) {
      console.error('DEBUG getUserLoansRaw error:', err);
      return [];
    }
  }, [readClient, lendingPoolContract.address, lendingPoolContract.abi, address]);

  const getLoanByIdRaw = useCallback(async (loanId: bigint | number | string) => {
    if (!readClient || !lendingPoolContract.address || !lendingPoolContract.abi || !address) {
      setError('Loan by ID: missing address or contract.');
      return null;
    }
    try {
      const id = typeof loanId === 'bigint' ? loanId : BigInt(loanId);
      const details = await readClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'loans',
        args: [id],
      });
      return details;
    } catch (err) {
      console.error('DEBUG getLoanByIdRaw error for', loanId, err);
      return null;
    }
  }, [readClient, lendingPoolContract.address, lendingPoolContract.abi]);

  const fetchUserLoans = useCallback(async () => {
    if (!address) {
      setError('Fetch user loans: missing address.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      // Fetch both all loans and active loans in parallel
      const [allLoans, actLoans] = await Promise.all([
        getAllUserLoans(),
        getActiveUserLoans(),
      ]);
      setUserLoans(allLoans);
      setActiveLoans(actLoans);
      // Calculate statistics from all loans
      const repaidLoans = allLoans.filter(loan => loan.status === 'repaid');
      const liquidatedLoans = allLoans.filter(loan => loan.status === 'liquidated');
      const totalInterest = allLoans.reduce((sum, loan) => sum + Number(loan.interestAccrued), 0);
      setBorrowStats({
        totalLoans: allLoans.length,
        activeLoans: actLoans.length,
        repaidLoans: repaidLoans.length,
        liquidatedLoans: liquidatedLoans.length,
        totalBorrowed: allLoans.reduce((sum, loan) => sum + Number(loan.amount), 0),
        totalInterest,
        totalRepaid: repaidLoans.reduce((sum, loan) => sum + Number(loan.amount), 0)
      });
      // Note: Borrowing capacity is now calculated in the component using getMaxBorrowAmount for each invoice
      // This provides more accurate per-invoice capacity instead of a general LTV percentage
      // The safeLendingAmount is now fetched on mount
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch loans');
    } finally {
      setIsLoading(false);
    }
  }, [address, getAllUserLoans, getActiveUserLoans, getBorrowingCapacity]);

  const getMaxBorrowAmount = useCallback(async (tokenId: string) => {
    try {
      if (!readClient || !lendingPoolContract.address || !lendingPoolContract.abi || !address) {
        setError('Max borrow amount: missing address or contract.');
        return '0';
      }

      const maxBorrow = await readClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getMaxBorrowAmount',
        args: [BigInt(tokenId)],
      }) as bigint;

      // USDC has 6 decimals, not 18
      return formatAmount(maxBorrow, 6);
    } catch (err) {
      console.error('Error getting max borrow amount:', err);
      return '0';
    }
  }, [readClient, lendingPoolContract.address, lendingPoolContract.abi]);

  // Updated borrow function to use depositInvoiceAndBorrow
  const borrow = useCallback(async (tokenId: string, borrowAmount: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (isPrivy) {
        // Use seamless batch transactions for suppliers
        const parsedAmount = parseAmount(borrowAmount, 6);
        console.log('Borrow debug:', { tokenId, borrowAmount, parsedAmount });

        // Execute approve and borrow in one seamless batch
        const transactions = [
          {
            to: lendingPoolContract.address,
            data: encodeFunctionData({
              abi: lendingPoolContract.abi,
              functionName: 'approve',
              args: [lendingPoolContract.address, BigInt(tokenId)],
            }),
          },
          {
            to: lendingPoolContract.address,
            data: encodeFunctionData({
              abi: lendingPoolContract.abi,
              functionName: 'depositInvoiceAndBorrow',
              args: [BigInt(tokenId), parsedAmount],
            }),
          },
        ];

        const results = await executeBatchTransactions(transactions, publicClient?.chain.id);
        toast.success('Borrow successful!');
        return results[1].hash; // Return the borrow transaction hash
      }
      if (!walletClient || !address || !publicClient) {
        throw new Error('Wallet client, address, or public client not available.');
      }

      const parsedAmount2 = parseAmount(borrowAmount, 6);

      // Use the new depositInvoiceAndBorrow function
      const { request } = await publicClient.simulateContract({
        account: address as `0x${string}`,
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'depositInvoiceAndBorrow',
        args: [BigInt(tokenId), parsedAmount2],
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });

      // Refresh data
      await fetchUserLoans();

      toast.success('Borrow successful!');
      return hash;
    } catch (err) {
      console.error('Error borrowing:', err);
      setError(err instanceof Error ? err.message : 'Borrowing failed');
      toast.error('Borrowing failed. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [lendingPoolContract, walletClient, address, publicClient, isPrivy, sendTransaction, fetchUserLoans]);

  // Effect to fetch data on address change or periodically
  useEffect(() => {
    if (address) {
      fetchUserLoans();
      
      // Set up polling every 30 seconds
      const interval = setInterval(() => {
        fetchUserLoans();
      }, 30000);
      
      return () => clearInterval(interval);
    } else {
      setError('Effect: missing address, not polling.');
    }
  }, [address, fetchUserLoans, getBorrowingCapacity]);

  return {
    userLoans, // all loans (history)
    activeLoans, // only active loans
    borrowStats,
    animatedStats,
    isLoading,
    error,
    borrow,
    getMaxBorrowAmount,
    getBorrowingCapacity,
    // Expose the system-level function for future use
    getSystemWideSafeLendingAmount,
    borrowingCapacity,
    safeLendingAmount,
    refetch: fetchUserLoans,
    getUserLoansRaw, // debug export
    getLoanByIdRaw, // debug export
  };
} 