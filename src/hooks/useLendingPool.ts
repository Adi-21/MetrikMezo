import { useState, useCallback, useEffect } from 'react';
import { useContract } from './useContract';
import { usePublicClient, useAccount, useWalletClient } from 'wagmi';
import { formatAmount } from '@/lib/utils/contracts';
import { type Address, parseUnits } from 'viem';
import { toast } from 'react-toastify';
import { useSendTransaction } from '@privy-io/react-auth';
import { encodeFunctionData } from 'viem';

// Types for the new lending pool functions
export interface LPDeposit {
  amount: bigint;
  depositTime: bigint;
  lastInterestClaimed: bigint;
  withdrawnAmount: bigint;
  depositId: bigint;
  tranche: number; // 0 = Junior, 1 = Senior
  lockupDuration: bigint;
}

export interface LPTrancheBreakdown {
  juniorPrincipal: bigint;
  seniorPrincipal: bigint;
}

export enum Tranche {
  JUNIOR = 0,
  SENIOR = 1,
}

export function useLendingPool(addressOverride?: string) {
  const { contract: lendingPoolContract } = useContract('lendingPool');
  const { contract: usdcContract } = useContract('usdc');
  const { contract: musdContract } = useContract('musd');
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { address: wagmiAddress } = useAccount();
  const { sendTransaction } = useSendTransaction();
  // Use override if provided, else Wagmi address
  const address: Address | undefined = (addressOverride || wagmiAddress) as Address | undefined;

  const [borrowedAmount, setBorrowedAmount] = useState<string>('0');
  const [availableLiquidity, setAvailableLiquidity] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<bigint | undefined>(undefined);
  const [musdBalance, setMusdBalance] = useState<bigint | undefined>(undefined);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [isBalanceError, setIsBalanceError] = useState(false);
  const [balanceError, setBalanceError] = useState<Error | null>(null);

  // New state for additional lending pool data
  const [userTotalDeposits, setUserTotalDeposits] = useState<string>('0');
  const [userDeposits, setUserDeposits] = useState<LPDeposit[]>([]);
  const [trancheBreakdown, setTrancheBreakdown] = useState<LPTrancheBreakdown | null>(null);
  const [isRegisteredLP, setIsRegisteredLP] = useState<boolean>(false);
  const [lpInterest, setLpInterest] = useState<string>('0');
  const [activeDeposits, setActiveDeposits] = useState<LPDeposit[]>([]);
  const [borrowingCapacity, setBorrowingCapacity] = useState<string>('0');
  const [userActiveLoans, setUserActiveLoans] = useState<bigint[]>([]);
  const [allRegisteredLPs, setAllRegisteredLPs] = useState<Address[]>([]);

  const fetchBorrowedAmount = useCallback(async (userAddress: Address) => {
    if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi) {
      setBorrowedAmount('0');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getUserTotalBorrowed',
        args: [userAddress as Address],
      });
      setBorrowedAmount(formatAmount(data as bigint, 6)); // MUSD has 6 decimals
    } catch (err) {
      console.error('Error fetching borrowed amount:', err);
      setError(err as Error);
      setBorrowedAmount('0');
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi]);

  const fetchAvailableLiquidity = useCallback(async () => {
    if (!publicClient || !usdcContract.address || !usdcContract.abi || !lendingPoolContract.address) {
      setAvailableLiquidity('0');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await publicClient.readContract({
        address: usdcContract.address,
        abi: usdcContract.abi,
        functionName: 'balanceOf',
        args: [address as Address],
      });
      setAvailableLiquidity(formatAmount(data as bigint, 6)); // MUSD has 6 decimals
    } catch (err) {
      console.error('Error fetching available liquidity:', err);
      setError(err as Error);
      setAvailableLiquidity('0');
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, usdcContract.address, usdcContract.abi, lendingPoolContract.address, address]);

  const fetchUsdcBalance = useCallback(async () => {
    setIsBalanceLoading(true);
    setIsBalanceError(false);
    setBalanceError(null);
    if (!publicClient || !usdcContract.address || !usdcContract.abi || !address) {
      setUsdcBalance(undefined);
      setIsBalanceLoading(false);
      return;
    }
    try {
      const data = await publicClient.readContract({
        address: usdcContract.address,
        abi: usdcContract.abi,
        functionName: 'balanceOf',
        args: [address as Address],
      });
      setUsdcBalance(data as bigint);
    } catch (err) {
      console.error('Error fetching MUSD balance:', err);
      setIsBalanceError(true);
      setBalanceError(err as Error);
      setUsdcBalance(undefined);
    } finally {
      setIsBalanceLoading(false);
    }
  }, [publicClient, usdcContract.address, usdcContract.abi, address]);

  const fetchMusdBalance = useCallback(async () => {
    setIsBalanceLoading(true);
    setIsBalanceError(false);
    setBalanceError(null);
    if (!publicClient || !musdContract.address || !musdContract.abi || !address) {
      setMusdBalance(undefined);
      setIsBalanceLoading(false);
      return;
    }
    try {
      const data = await publicClient.readContract({
        address: musdContract.address,
        abi: musdContract.abi,
        functionName: 'balanceOf',
        args: [address as Address],
      });
      setMusdBalance(data as bigint);
    } catch (err) {
      console.error('Error fetching MUSD balance:', err);
      setIsBalanceError(true);
      setBalanceError(err as Error);
      setMusdBalance(undefined);
    } finally {
      setIsBalanceLoading(false);
    }
  }, [publicClient, musdContract.address, musdContract.abi, address]);

  // Effect to refetch data on address change or periodically
  useEffect(() => {
    if (address) {
      fetchBorrowedAmount(address);
      fetchAvailableLiquidity();
      fetchUsdcBalance();
      fetchMusdBalance();

      const interval = setInterval(() => {
        fetchBorrowedAmount(address);
        fetchAvailableLiquidity();
        fetchUsdcBalance();
        fetchMusdBalance();
      }, 15000); // Refetch every 15 seconds

      return () => clearInterval(interval);
    }
  }, [address, fetchBorrowedAmount, fetchAvailableLiquidity, fetchUsdcBalance, fetchMusdBalance]);

  const getLPInterest = useCallback(async (lpAddress?: string): Promise<string> => {
    if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi) {
      setLpInterest('0');
      return '0';
    }

    try {
      const interest = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getLPInterest',
        args: [(lpAddress || address || '0x0') as Address],
      });
      const formattedInterest = formatAmount(interest as bigint, 6); // MUSD has 6 decimals
      setLpInterest(formattedInterest);
      return formattedInterest;
    } catch (err) {
      console.error('Error fetching LP interest:', err);
      setLpInterest('0');
      return '0';
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi, address, setLpInterest]);

  useEffect(() => {
    if (address) {
      getLPInterest(address);
    }
  }, [address, getLPInterest]);

  const deposit = useCallback(async (amount: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!lendingPoolContract || !lendingPoolContract.address || !lendingPoolContract.abi) {
        throw new Error('Lending pool contract not available.');
      }

      if (!musdContract || !musdContract.address || !musdContract.abi) {
        throw new Error('Stablecoin (MUSD) contract not available.');
      }

      if (!address) {
        throw new Error('Wallet not connected.');
      }

      if (!publicClient) {
        throw new Error('Public client not available. Please ensure network is connected.');
      }

      if (isBalanceLoading) {
        throw new Error('Loading MUSD balance... Please wait.');
      }

      if (isBalanceError) {
        throw new Error(`Error fetching MUSD balance: ${balanceError?.message}`);
      }

      const parsedAmount = parseUnits(amount, 6); // MUSD has 6 decimals
      
      // Check if user has enough balance
      if (typeof musdBalance !== 'bigint') {
        throw new Error('Invalid MUSD balance format. Please try again.');
      }

      if (parsedAmount > musdBalance) {
        throw new Error(`Insufficient MUSD balance. You have ${formatAmount(musdBalance, 6)} but trying to deposit ${amount}.`);
      }

      if (!walletClient) {
        throw new Error('Wallet client not available. Please ensure your wallet is connected.');
      }

      // First approve the lending pool to spend MUSD
      const { request: approveRequest } = await publicClient.simulateContract({
        account: address,
        address: musdContract.address,
        abi: musdContract.abi,
        functionName: 'approve',
        args: [lendingPoolContract.address, parsedAmount],
      });

      const approveHash = await walletClient.writeContract(approveRequest);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Then deposit in LendingPool
      const { request: depositRequest } = await publicClient.simulateContract({
        account: address,
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'deposit',
        args: [parsedAmount],
      });

      const depositHash = await walletClient.writeContract(depositRequest);
      await publicClient.waitForTransactionReceipt({ hash: depositHash });

      toast.success('Deposit successful!');
      return depositHash;
    } catch (err) {
      console.error('Error depositing:', err);
      setError(err as Error);
      toast.error('Deposit failed. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [lendingPoolContract, musdContract, musdBalance, address, isBalanceLoading, isBalanceError, balanceError, walletClient, publicClient]);

  const withdraw = useCallback(async (amount: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!lendingPoolContract || !lendingPoolContract.address || !lendingPoolContract.abi) {
        throw new Error('Lending pool contract not available.');
      }

      if (!walletClient || !address || !publicClient) {
        throw new Error('Wallet client, address, or public client not available.');
      }

      const parsedAmount = parseUnits(amount, 6); // MUSD has 6 decimals

      const { request } = await publicClient.simulateContract({
        account: address,
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'withdraw',
        args: [parsedAmount],
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });

      toast.success('Withdrawal successful!');
      return hash;
    } catch (err) {
      console.error('Error withdrawing:', err);
      setError(err as Error);
      toast.error('Withdrawal failed. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [lendingPoolContract, walletClient, publicClient, address]);

  const borrow = useCallback(async (tokenId: string, amount: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!lendingPoolContract || !lendingPoolContract.address || !lendingPoolContract.abi) {
        throw new Error('Lending pool contract not available.');
      }

      if (!walletClient || !address || !publicClient) {
        throw new Error('Wallet client, address, or public client not available.');
      }

      // Amount is already in MUSD decimals (6)
      const parsedAmount = BigInt(amount);

      const { request } = await publicClient.simulateContract({
        account: address,
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'depositInvoiceAndBorrow',
        args: [BigInt(tokenId), parsedAmount],
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });

      toast.success('Borrow successful!');
      return hash;
    } catch (err) {
      console.error('Error borrowing:', err);
      
      // Handle different types of errors
      let errorMessage = 'Borrow failed. Please try again.';
      
      if (err instanceof Error) {
        // Check if it's a contract revert with custom error
        if (err.message.includes('0x177e802f')) {
          errorMessage = 'Borrow amount exceeds maximum allowed or invoice is not eligible for borrowing.';
        } else if (err.message.includes('InvalidBorrowAmount')) {
          errorMessage = 'Borrow amount exceeds maximum allowed for this invoice.';
        } else if (err.message.includes('InvoiceNotVerified')) {
          errorMessage = 'Invoice must be verified before borrowing.';
        } else if (err.message.includes('LoanAlreadyExists')) {
          errorMessage = 'A loan already exists for this invoice.';
        } else if (err.message.includes('InvoiceExpired')) {
          errorMessage = 'Invoice has expired and cannot be used for borrowing.';
        } else if (err.message.includes('NotInvoiceSupplier')) {
          errorMessage = 'You are not the supplier of this invoice.';
        } else if (err.message.includes('NoStakedTokensFound')) {
          errorMessage = 'You must have staked tokens to borrow.';
        } else if (err.message.includes('InsufficientLiquidity')) {
          errorMessage = 'Insufficient liquidity in the lending pool.';
        } else {
          // Try to extract a more specific error message
          const errorMatch = err.message.match(/reverted with reason string: (.+)/);
          if (errorMatch) {
            errorMessage = errorMatch[1];
          }
        }
      }
      
      setError(new Error(errorMessage));
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [lendingPoolContract, walletClient, publicClient, address]);

  const getUserActiveLoans = useCallback(async (userAddress: Address) => {
    if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi) {
      return [];
    }
    try {
      
      // First check if user has any borrowed amount
      try {
        const totalBorrowed = await publicClient.readContract({
          address: lendingPoolContract.address,
          abi: lendingPoolContract.abi,
          functionName: 'getUserTotalBorrowed',
          args: [userAddress as Address],
        }) as bigint;
        
        if (totalBorrowed === BigInt(0)) {
          return [];
        }
      } catch (err) {
        console.error('getUserActiveLoans: Error checking total borrowed amount:', err);
      }
      
      // First try getUserActiveLoans
      let loanIds: bigint[] = [];
      try {
        loanIds = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getUserActiveLoans',
        args: [userAddress as Address],
      }) as bigint[];
      } catch (err) {
        try {
          loanIds = await publicClient.readContract({
            address: lendingPoolContract.address,
            abi: lendingPoolContract.abi,
            functionName: 'getUserLoans',
            args: [userAddress as Address],
          }) as bigint[];
        } catch (err2) {
          console.error('getUserActiveLoans: getUserLoans also failed:', err2);
          // If both fail, return empty array
          loanIds = [];
        }
      }
      
      // Filter out invalid loan IDs (empty, undefined, but allow 0)
      const validLoanIds = loanIds
        .map(id => id.toString())
        .filter(id => id !== '' && id !== 'undefined');
      
      
      // If no loans found from contract functions, try to find them manually
      if (validLoanIds.length === 0) {
        
        // Try common invoice IDs that might have loans
        const possibleInvoiceIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
        
        for (const invoiceId of possibleInvoiceIds) {
          try {
            const loanDetails = await publicClient.readContract({
              address: lendingPoolContract.address,
              abi: lendingPoolContract.abi,
              functionName: 'getUserLoanDetails',
              args: [userAddress as Address, BigInt(invoiceId)],
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
      
      return validLoanIds;
    } catch (err) {
      console.error('Error getting user active loans:', err);
      return [];
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi]);

  const getUserLoanDetails = useCallback(async (userAddress: Address, tokenId: string) => {
    if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi) {
      return null;
    }
    try {
      const details = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getUserLoanDetails',
        args: [userAddress as Address, BigInt(tokenId)],
      }) as any;

      // Add a check for essential properties by index before formatting
      if (!details || typeof details[0] === 'undefined' || typeof details[4] === 'undefined' || typeof details[1] === 'undefined') {
        console.error('getUserLoanDetails: Missing essential loan details properties from contract response:', details);
        return null;
      }

      return {
        amount: formatAmount(details[0], 6),
        dueDate: new Date(Number(details[1]) * 1000),
        isRepaid: details[2],
        isLiquidated: details[3],
        interestAccrued: formatAmount(details[4], 6),
      };
    } catch (err: any) {
      // Only log unexpected errors, not 'Loan not found or not active'
      if (!err?.message?.includes('Loan not found or not active')) {
        console.error('Error getting user loan details:', err);
      }
      return null;
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi]);

  const repay = useCallback(async (tokenId: string) => {
    let loanDetails: any = null;
    let totalAmountDue: bigint | undefined = undefined;
    try {
      setIsLoading(true);
      setError(null);

      if (!lendingPoolContract || !lendingPoolContract.address || !lendingPoolContract.abi) {
        throw new Error('Lending pool contract not available.');
      }

      if (!usdcContract || !usdcContract.address || !usdcContract.abi) {
        throw new Error('Stablecoin contract not available.');
      }

      if (!address || !publicClient) {
        throw new Error('Address or public client not available.');
      }

      // Validate tokenId - allow '0' as valid
      if (!tokenId || tokenId === '') {
        throw new Error('Invalid invoice ID. Please select a valid invoice to repay.');
      }

      loanDetails = await getUserLoanDetails(address, tokenId);
      if (!loanDetails) {
        throw new Error('Loan details not found for this invoice. Please ensure you have an active loan for this invoice.');
      }

      // Check if loan is already repaid
      if (loanDetails.isRepaid) {
        throw new Error('This loan has already been repaid.');
      }

      // Check if loan is liquidated
      if (loanDetails.isLiquidated) {
        throw new Error('This loan has been liquidated and cannot be repaid.');
      }

      // Check if loan is overdue (for informational purposes only)
      const currentTime = Math.floor(Date.now() / 1000);
      const dueDateTimestamp = Math.floor(loanDetails.dueDate.getTime() / 1000);
      const isOverdue = currentTime > dueDateTimestamp;
      
      // Note: Early repayment should be allowed, so we don't block non-overdue loans

      const buffer = parseUnits('1', 6); // 1 MUSD
      totalAmountDue = parseUnits((parseFloat(loanDetails.amount) + parseFloat(loanDetails.interestAccrued)).toFixed(6), 6) + buffer; // Convert to BigInt with 6 decimals

      // Check if Privy embedded wallet is being used
      const isPrivy = address && address.toLowerCase().startsWith('0x'); // You may want a more robust check
      if (isPrivy && sendTransaction) {
        // Approve MUSD for LendingPool
        const approveData = encodeFunctionData({
          abi: musdContract.abi,
          functionName: 'approve',
          args: [lendingPoolContract.address, totalAmountDue],
        });
        const approveTx = await sendTransaction({
          to: musdContract.address,
          data: approveData,
          value: 0n,
          chainId: publicClient.chain.id,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveTx.hash });

        // Repay loan
        const repayData = encodeFunctionData({
          abi: lendingPoolContract.abi,
          functionName: 'repay',
          args: [BigInt(tokenId)],
        });
        const repayTx = await sendTransaction({
          to: lendingPoolContract.address,
          data: repayData,
          value: 0n,
          chainId: publicClient.chain.id,
        });
        await publicClient.waitForTransactionReceipt({ hash: repayTx.hash });
        toast.success('Repayment successful!');
        return repayTx.hash;
      }

      // First approve the lending pool to spend MUSD for repayment
      const { request: approveRequest } = await publicClient.simulateContract({
        account: address,
        address: musdContract.address,
        abi: musdContract.abi,
        functionName: 'approve',
        args: [lendingPoolContract.address, totalAmountDue],
      });

      if (!walletClient) {
        throw new Error('Wallet client not available. Please ensure your wallet is connected.');
      }
      const approveHash = await walletClient.writeContract(approveRequest);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Then repay in LendingPool
      const { request: repayRequest } = await publicClient.simulateContract({
        account: address,
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'repay',
        args: [BigInt(tokenId)],
      });

      const repayHash = await walletClient.writeContract(repayRequest);
      await publicClient.waitForTransactionReceipt({ hash: repayHash });

      toast.success('Repayment successful!');
      return repayHash;
    } catch (err: any) {
      console.error('Error repaying:', err);
      
      // Handle specific contract errors
      let errorMessage = 'Repayment failed. Please try again.';
      
      if (err.message?.includes('0xe450d38c')) {
        // Check MUSD balance
        try {
          if (!publicClient) {
            errorMessage = 'Loan repayment failed. Could not check MUSD balance because publicClient is unavailable.';
          } else {
            // Ensure totalAmountDue is defined
            let amountDue = totalAmountDue;
            if (typeof amountDue === 'undefined' && loanDetails) {
              const buffer = parseUnits('1', 6); // 1 MUSD
              amountDue = parseUnits((parseFloat(loanDetails.amount) + parseFloat(loanDetails.interestAccrued)).toFixed(6), 6) + buffer;
            }
            if (typeof amountDue === 'undefined') {
              errorMessage = 'Loan repayment failed. Could not determine total amount due.';
            } else {
              const musdBal = await publicClient.readContract({
                address: musdContract.address,
                abi: musdContract.abi,
                functionName: 'balanceOf',
                args: [address as Address],
              }) as bigint;
              if (musdBal < amountDue) {
                errorMessage = `Insufficient MUSD balance. You need ${formatAmount(amountDue, 6)} but have ${formatAmount(musdBal, 6)}.`;
              } else {
                errorMessage = 'Loan repayment failed. This could be due to: 1) Loan already repaid, 2) You are not the loan owner, 3) Insufficient MUSD approval, or 4) Contract conditions not met.';
              }
            }
          }
        } catch (balanceErr) {
          errorMessage = 'Loan repayment failed. Please check your MUSD balance and ensure the loan is overdue.';
        }
      } else if (err.message?.includes('LoanAlreadySettled')) {
        errorMessage = 'This loan has already been repaid.';
      } else if (err.message?.includes('NotLoanOwner')) {
        errorMessage = 'You are not the owner of this loan.';
      } else if (err.message?.includes('LoanNotOverdue')) {
        errorMessage = 'This loan is not overdue and cannot be repaid yet.';
      } else if (err.message?.includes('InsufficientBalance')) {
        errorMessage = 'Insufficient MUSD balance to repay the loan.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(new Error(errorMessage));
      toast.error(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [lendingPoolContract, musdContract, walletClient, publicClient, address, getUserLoanDetails, sendTransaction]);

  const getMaxBorrowAmount = async (tokenId: string): Promise<string> => {
    if (!lendingPoolContract || !lendingPoolContract.address || !lendingPoolContract.abi) {
      throw new Error('Lending pool contract not available.');
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await publicClient?.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getMaxBorrowAmount',
        args: [BigInt(tokenId)],
      });
      setIsLoading(false);
      // Return the raw value as a string (in 1e6 units for MUSD)
      return (data as bigint).toString();
    } catch (err) {
      console.error('Error fetching max borrow amount:', err);
      setError(err as Error);
      throw err;
    }
  };

  const withdrawInterest = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!walletClient || !address || !publicClient) {
        throw new Error('Wallet client, address, or public client not available.');
      }

      const { request } = await publicClient.simulateContract({
        account: address,
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'withdrawInterest',
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });

      return hash;
    } catch (err) {
      console.error('Error withdrawing interest:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address, publicClient, lendingPoolContract.address, lendingPoolContract.abi]);

  const withdrawJuniorInterest = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!walletClient || !address || !publicClient) {
        throw new Error('Wallet client, address, or public client not available.');
      }
      const { request } = await publicClient.simulateContract({
        account: address,
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'withdrawJuniorInterest',
      });
      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    } catch (err) {
      console.error('Error withdrawing junior interest:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address, publicClient, lendingPoolContract.address, lendingPoolContract.abi]);

  const withdrawSeniorInterest = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!walletClient || !address || !publicClient) {
        throw new Error('Wallet client, address, or public client not available.');
      }
      const { request } = await publicClient.simulateContract({
        account: address,
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'withdrawSeniorInterest',
      });
      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    } catch (err) {
      console.error('Error withdrawing senior interest:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address, publicClient, lendingPoolContract.address, lendingPoolContract.abi]);

  const getUserLoans = useCallback(async (userAddress: Address) => {
    if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi) {
      return [];
    }
    try {
      const loanIds = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getUserLoans',
        args: [userAddress as Address],
      }) as bigint[];
      return loanIds.map(id => id.toString());
    } catch (err) {
      console.error('Error getting user loans:', err);
      return [];
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi]);

  // New function to get user's total LP deposits
  const getUserTotalLPDeposits = useCallback(async (lpAddress?: string): Promise<string> => {
    if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi) {
      setUserTotalDeposits('0');
      return '0';
    }

    try {
      const deposits = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getUserTotalLPDeposits',
        args: [(lpAddress || address || '0x0') as Address],
      });
      const formattedDeposits = formatAmount(deposits as bigint, 6); // MUSD has 6 decimals
      setUserTotalDeposits(formattedDeposits);
      return formattedDeposits;
    } catch (err) {
      console.error('Error fetching user total LP deposits:', err);
      setUserTotalDeposits('0');
      return '0';
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi, address, setUserTotalDeposits]);

  // New function to get user's LP deposits
  const getUserLPDeposits = useCallback(async (lpAddress?: string): Promise<LPDeposit[]> => {
    if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi) {
      setUserDeposits([]);
      return [];
    }

    try {
      const deposits = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getUserLPDeposits',
        args: [(lpAddress || address || '0x0') as Address],
      });
      const depositsArray = deposits as LPDeposit[];
      setUserDeposits(depositsArray);
      return depositsArray;
    } catch (err) {
      console.error('Error fetching user LP deposits:', err);
      setUserDeposits([]);
      return [];
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi, address, setUserDeposits]);

  // New function to get LP tranche breakdown
  const getLPTrancheBreakdown = useCallback(async (lpAddress?: string): Promise<LPTrancheBreakdown | null> => {
    if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi) {
      setTrancheBreakdown(null);
      return null;
    }

    try {
      const breakdown = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getLPTrancheBreakdown',
        args: [(lpAddress || address || '0x0') as Address],
      });
      
      if (Array.isArray(breakdown) && breakdown.length === 2) {
        const trancheData = {
          juniorPrincipal: breakdown[0] as bigint,
          seniorPrincipal: breakdown[1] as bigint,
        };
        setTrancheBreakdown(trancheData);
        return trancheData;
      }
      setTrancheBreakdown(null);
      return null;
    } catch (err) {
      console.error('Error fetching LP tranche breakdown:', err);
      setTrancheBreakdown(null);
      return null;
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi, address, setTrancheBreakdown]);

  // New function to check if LP is registered
  const checkIsRegisteredLP = useCallback(async (lpAddress?: string): Promise<boolean> => {
    if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi) {
      setIsRegisteredLP(false);
      return false;
    }

    try {
      const isRegistered = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'isRegisteredLP',
        args: [(lpAddress || address || '0x0') as Address],
      });
      const registered = Boolean(isRegistered);
      setIsRegisteredLP(registered);
      return registered;
    } catch (err) {
      console.error('Error checking if LP is registered:', err);
      setIsRegisteredLP(false);
      return false;
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi, address, setIsRegisteredLP]);

  // New function to get LP active deposits
  const getLPActiveDeposits = useCallback(async (lpAddress?: string): Promise<LPDeposit[]> => {
    if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi) {
      setActiveDeposits([]);
      return [];
    }

    try {
      const deposits = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getLPActiveDeposits',
        args: [(lpAddress || address || '0x0') as Address],
      });
      const depositsArray = deposits as LPDeposit[];
      setActiveDeposits(depositsArray);
      return depositsArray;
    } catch (err) {
      console.error('Error fetching LP active deposits:', err);
      setActiveDeposits([]);
      return [];
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi, address, setActiveDeposits]);

  // New function to get borrowing capacity
  const getBorrowingCapacity = useCallback(async (userAddress?: string): Promise<string> => {
    if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi) {
      return '0';
    }

    try {
      const capacity = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getBorrowingCapacity',
        args: [(userAddress || address || '0x0') as Address],
      });
      return formatAmount(capacity as bigint, 6); // MUSD has 6 decimals
    } catch (err) {
      console.error('Error fetching borrowing capacity:', err);
      return '0';
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi, address]);

  // New function to get safe lending amount
  const getSafeLendingAmount = useCallback(async (userAddress?: string, invoiceAmount?: bigint): Promise<string> => {
    if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi) {
      return '0';
    }

    try {
      const safeAmount = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getSafeLendingAmount',
        args: [(userAddress || address || '0x0') as Address, invoiceAmount || BigInt(0)],
      });
      return formatAmount(safeAmount as bigint, 6); // MUSD has 6 decimals
    } catch (err) {
      console.error('Error fetching safe lending amount:', err);
      return '0';
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi, address]);



  // New function to get all registered LPs
  const getAllRegisteredLPs = useCallback(async (): Promise<Address[]> => {
    if (!publicClient || !lendingPoolContract.address || !lendingPoolContract.abi) {
      setAllRegisteredLPs([]);
      return [];
    }

    try {
      const lps = await publicClient.readContract({
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'getAllRegisteredLPs',
        args: [],
      });
      const lpsArray = lps as Address[];
      setAllRegisteredLPs(lpsArray);
      return lpsArray;
    } catch (err) {
      console.error('Error fetching all registered LPs:', err);
      setAllRegisteredLPs([]);
      return [];
    }
  }, [publicClient, lendingPoolContract.address, lendingPoolContract.abi, setAllRegisteredLPs]);

  // New function to deposit with tranche selection
  const depositWithTranche = useCallback(async (amount: string, tranche: Tranche, lockupDuration: number) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!lendingPoolContract || !lendingPoolContract.address || !lendingPoolContract.abi) {
        throw new Error('Lending pool contract not available.');
      }

      if (!usdcContract || !usdcContract.address || !usdcContract.abi) {
        throw new Error('USDC contract not available.');
      }

      if (!address) {
        throw new Error('Wallet not connected.');
      }

      if (!publicClient) {
        throw new Error('Public client not available. Please ensure network is connected.');
      }

      if (isBalanceLoading) {
        throw new Error('Loading USDC balance... Please wait.');
      }

      if (isBalanceError) {
        throw new Error(`Error fetching USDC balance: ${balanceError?.message}`);
      }

      const parsedAmount = parseUnits(amount, 6); // USDC has 6 decimals
      
      // Check if user has enough balance
      if (typeof usdcBalance !== 'bigint') {
        throw new Error('Invalid USDC balance format. Please try again.');
      }

      if (parsedAmount > usdcBalance) {
        throw new Error(`Insufficient USDC balance. You have ${formatAmount(usdcBalance, 6)} but trying to deposit ${amount}.`);
      }

      if (!walletClient) {
        throw new Error('Wallet client not available. Please ensure your wallet is connected.');
      }

      // First approve the lending pool to spend USDC
      const { request: approveRequest } = await publicClient.simulateContract({
        account: address,
        address: usdcContract.address,
        abi: usdcContract.abi,
        functionName: 'approve',
        args: [lendingPoolContract.address, parsedAmount],
      });

      const approveHash = await walletClient.writeContract(approveRequest);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Then deposit with tranche in LendingPool
      const { request: depositRequest } = await publicClient.simulateContract({
        account: address,
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'depositWithTranche',
        args: [parsedAmount, tranche, BigInt(lockupDuration)],
      });

      const depositHash = await walletClient.writeContract(depositRequest);
      await publicClient.waitForTransactionReceipt({ hash: depositHash });

      toast.success('Tranche deposit successful!');
      return depositHash;
    } catch (err) {
      console.error('Error depositing with tranche:', err);
      setError(err as Error);
      toast.error('Tranche deposit failed. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [lendingPoolContract, usdcContract, usdcBalance, address, isBalanceLoading, isBalanceError, balanceError, walletClient, publicClient]);

  // New function to deposit invoice and borrow
  const depositInvoiceAndBorrow = useCallback(async (tokenId: string, amount: string) => {
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

      const parsedAmount = parseUnits(amount, 6); // USDC has 6 decimals
      const parsedTokenId = BigInt(tokenId);

      // First approve the lending pool to spend the invoice NFT
      const { request: approveRequest } = await publicClient.simulateContract({
        account: address,
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'approve',
        args: [lendingPoolContract.address, parsedTokenId],
      });

      const approveHash = await walletClient.writeContract(approveRequest);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Then deposit invoice and borrow
      const { request: borrowRequest } = await publicClient.simulateContract({
        account: address,
        address: lendingPoolContract.address,
        abi: lendingPoolContract.abi,
        functionName: 'depositInvoiceAndBorrow',
        args: [parsedTokenId, parsedAmount],
      });

      const borrowHash = await walletClient.writeContract(borrowRequest);
      await publicClient.waitForTransactionReceipt({ hash: borrowHash });

      toast.success('Invoice deposit and borrow successful!');
      return borrowHash;
    } catch (err) {
      console.error('Error depositing invoice and borrowing:', err);
      setError(err as Error);
      toast.error('Invoice deposit and borrow failed. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [lendingPoolContract, address, walletClient, publicClient]);

  const withdrawByTranche = useCallback(
    async (amount: string, tranche: Tranche) => {
      try {
        setIsLoading(true);
        setError(null);

        if (!lendingPoolContract || !lendingPoolContract.address || !lendingPoolContract.abi) {
          throw new Error('Lending pool contract not available.');
        }
        if (!walletClient || !address || !publicClient) {
          throw new Error('Wallet client, address, or public client not available.');
        }

        const parsedAmount = parseUnits(amount, 6); // USDC has 6 decimals
        const { request } = await publicClient.simulateContract({
          account: address,
          address: lendingPoolContract.address,
          abi: lendingPoolContract.abi,
          functionName: 'withdrawByTranche',
          args: [parsedAmount, tranche],
        });
        const hash = await walletClient.writeContract(request);
        await publicClient.waitForTransactionReceipt({ hash });
        toast.success('Withdrawal successful!');
        return hash;
      } catch (err) {
        console.error('Error withdrawing by tranche:', err);
        setError(err as Error);
        toast.error('Withdrawal failed. Please try again.');
        throw err;
      } finally {
        setIsLoading(false);
      }
    }, [lendingPoolContract, walletClient, publicClient, address]);

  return {
    isLoading: isLoading || isBalanceLoading,
    error,
    borrowedAmount,
    availableLiquidity,
    // New state for additional data
    userTotalDeposits,
    userDeposits,
    trancheBreakdown,
    isRegisteredLP,
    lpInterest,
    activeDeposits,
    borrowingCapacity,
    userActiveLoans,
    allRegisteredLPs,
    // Functions
    deposit,
    withdraw,
    borrow,
    repay,
    usdcBalance: usdcBalance && typeof usdcBalance === 'bigint' ? formatAmount(usdcBalance, 6) : '0',
    getMaxBorrowAmount,
    withdrawInterest,
    getLPInterest,
    getUserActiveLoans,
    getUserLoanDetails,
    getUserLoans,
    // New functions
    depositWithTranche,
    depositInvoiceAndBorrow,
    getUserTotalLPDeposits,
    getUserLPDeposits,
    getLPTrancheBreakdown,
    checkIsRegisteredLP,
    getLPActiveDeposits,
    getBorrowingCapacity,
    getSafeLendingAmount,
    getAllRegisteredLPs,
    withdrawByTranche,
    withdrawJuniorInterest,
    withdrawSeniorInterest,
  };
} 