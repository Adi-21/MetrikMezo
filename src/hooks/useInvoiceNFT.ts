import { useState, useCallback, useEffect } from 'react';
import { useContract } from './useContract';
import { usePublicClient, useAccount, useWalletClient } from 'wagmi';
import { parseAmount, formatAmount } from '@/lib/utils/contracts';
import { type Address } from 'viem';
import { toast } from 'react-toastify';
import { useAnimatedValue } from './useAnimatedValue';
import { useWallets, useSendTransaction } from '@privy-io/react-auth';
import { encodeFunctionData } from 'viem';
import { useSeamlessTransaction } from './useSeamlessTransaction';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/config';

export interface Invoice {
  id: string;
  invoiceId: string;
  supplier: Address;
  buyer: Address;
  creditAmount: string;
  dueDate: Date;
  ipfsHash: string;
  gatewayUrl?: string;
  isVerified: boolean;
  // Optional fields for burned invoices
  isBurned?: boolean;
  burnTime?: Date;
  burnReason?: string;
}

// New interface for historical invoice records (including burned ones)
export interface HistoricalInvoiceRecord {
  tokenId: bigint;
  invoiceId: string;
  supplier: Address;
  buyer: Address;
  creditAmount: bigint;
  dueDate: bigint;
  ipfsHash: string;
  isVerified: boolean;
  mintTime: bigint;
  burnTime: bigint;
  isBurned: boolean;
  burnReason: string;
}

// Interface for user invoice statistics
export interface UserInvoiceStatistics {
  totalMinted: bigint;
  totalBurned: bigint;
  totalActive: bigint;
  totalCreditAmount: bigint;
}

interface RawInvoice {
  invoiceId: string;
  supplier: Address;
  buyer: Address;
  creditAmount: bigint;
  dueDate: bigint;
  ipfsHash: string;
  isVerified: boolean;
}

// New interface for invoice details with metadata
export interface InvoiceDetails {
  invoiceId: string;
  supplier: Address;
  buyer: Address;
  creditAmount: bigint;
  dueDate: bigint;
  ipfsHash: string;
  isVerified: boolean;
  metadata?: string; // Additional metadata field
}

export function useInvoiceNFT(address?: Address) {
  const { contract: invoiceNFTContract } = useContract('invoiceNFT');
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { address: currentAddress } = useAccount();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const { executeTransaction } = useSeamlessTransaction();
  const privyWallet = wallets.find(w => w.walletClientType === 'privy' || (w.meta && w.meta.id === 'io.privy.wallet'));
  const isPrivy = !!privyWallet?.address;
  const readClient = publicClient;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [userInvoices, setUserInvoices] = useState<Invoice[]>([]);
  const [historicalInvoices, setHistoricalInvoices] = useState<HistoricalInvoiceRecord[]>([]);
  const [userStatistics, setUserStatistics] = useState<UserInvoiceStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchInvoices = useCallback(async (userAddress: Address) => {
    if (!readClient || !invoiceNFTContract.address || !invoiceNFTContract.abi || !userAddress) {
      setInvoices([]);
      setError(new Error('Fetch invoices: missing address or contract.'));
      return;
    }
    try {
      // Read totalSupply - handle case where function doesn't exist
      let totalSupply = 0n;
      try {
        totalSupply = await readClient.readContract({
          address: invoiceNFTContract.address,
          abi: invoiceNFTContract.abi,
          functionName: 'totalSupply',
        }) as bigint;
      } catch (err) {
        totalSupply = 0n;
      }
      
      // Try to fetch more tokens than totalSupply to catch any gaps
      const maxTokensToCheck = Math.max(Number(totalSupply) + 5, 20); // Check extra tokens
      
      const invoicesArr = [];
      
      // Check for existing invoices by checking token IDs 1-20
      console.log('🔍 fetchInvoices: Checking for existing invoices...');
      for (let tokenId = 1; tokenId <= 20; tokenId++) {
        try {
          const invoiceDetails = await readClient.readContract({
            address: invoiceNFTContract.address,
            abi: invoiceNFTContract.abi,
            functionName: 'getInvoiceDetails',
            args: [BigInt(tokenId)],
          }) as RawInvoice;
          
          if (invoiceDetails && invoiceDetails.supplier) {
            console.log(`✅ Found invoice at token ID ${tokenId}`);
            invoicesArr.push({
              id: tokenId.toString(),
              invoiceId: invoiceDetails.invoiceId,
              supplier: invoiceDetails.supplier,
              buyer: invoiceDetails.buyer,
              creditAmount: invoiceDetails.creditAmount.toString(),
              dueDate: new Date(Number(invoiceDetails.dueDate) * 1000),
              ipfsHash: invoiceDetails.ipfsHash,
              isVerified: invoiceDetails.isVerified
            });
          }
        } catch (tokenErr) {
          // Token doesn't exist or other error, continue to next token
          continue;
        }
      }
      
      if (invoicesArr.length === 0) {
        console.log('📭 No invoices found in token IDs 1-20');
        setInvoices([]);
        setError(null); // Clear any previous errors - no invoices is not an error
        return;
      }
      
      console.log(`📋 fetchInvoices: Found ${invoicesArr.length} invoices total`);
      setInvoices(invoicesArr);
      setError(null);
    } catch (err) {
      console.error('useInvoiceNFT: Error in fetchInvoices:', err);
      
      // Fallback: Try to check for common invoice token IDs directly
      console.log('🔄 fetchInvoices: Trying fallback approach...');
      try {
        const fallbackInvoices = [];
        
        // Check for common token IDs (1-20) to see if any exist
        for (let tokenId = 1; tokenId <= 20; tokenId++) {
          try {
            const invoiceDetails = await readClient.readContract({
              address: invoiceNFTContract.address,
              abi: invoiceNFTContract.abi,
              functionName: 'getInvoiceDetails',
              args: [BigInt(tokenId)],
            }) as RawInvoice;
            
            if (invoiceDetails && invoiceDetails.supplier) {
              fallbackInvoices.push({
                id: tokenId.toString(),
                invoiceId: invoiceDetails.invoiceId,
                supplier: invoiceDetails.supplier,
                buyer: invoiceDetails.buyer,
                creditAmount: invoiceDetails.creditAmount.toString(),
                dueDate: new Date(Number(invoiceDetails.dueDate) * 1000),
                ipfsHash: invoiceDetails.ipfsHash,
                isVerified: invoiceDetails.isVerified
              });
            }
          } catch (tokenErr) {
            // Token doesn't exist or other error, continue
            continue;
          }
        }
        
        if (fallbackInvoices.length > 0) {
          console.log('✅ fetchInvoices fallback found invoices:', fallbackInvoices.length);
          setInvoices(fallbackInvoices);
          setError(null);
          return;
        } else {
          // No invoices found in fallback - this is not an error
          console.log('📭 fetchInvoices fallback: No invoices found');
          setInvoices([]);
          setError(null);
          return;
        }
      } catch (fallbackErr) {
        console.error('fetchInvoices fallback approach also failed:', fallbackErr);
        // Only set error if fallback also fails
        setInvoices([]);
        setError(err instanceof Error ? err : new Error('Unknown error fetching invoices'));
      }
    }
  }, [readClient, invoiceNFTContract.address, invoiceNFTContract.abi]);

  const fetchUserInvoices = useCallback(async (userAddress: Address) => {
    if (!readClient || !invoiceNFTContract.address || !invoiceNFTContract.abi) {
      setUserInvoices([]);
      setError(new Error('Fetch user invoices: missing address or contract.'));
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      // Get the latest block number first
      const latestBlock = await readClient.getBlockNumber();
      // Only fetch logs from the last 1,000 blocks to avoid RPC limits
      const fromBlock = latestBlock > 1000n ? latestBlock - 1000n : 0n;
      
      const logs = await readClient.getLogs({
        address: invoiceNFTContract.address,
        event: {
          type: 'event',
          name: 'InvoiceMinted',
          inputs: [
            { type: 'uint256', name: 'tokenId', indexed: true },
            { type: 'address', name: 'supplier', indexed: true },
            { type: 'string', name: 'invoiceId', indexed: false }
          ]
        },
        args: {
          supplier: userAddress
        },
        fromBlock,
        toBlock: 'latest'
      });
    

      const userInvoicePromises = [];

      // Process each InvoiceMinted event for the user
      for (const log of logs) {
        try {
          const tokenId = log.args.tokenId;

          if (!tokenId) {
            continue;
          }

          // Get invoice details for this token
          const invoiceDetails = await readClient.readContract({
            address: invoiceNFTContract.address,
            abi: invoiceNFTContract.abi,
            functionName: 'getInvoiceDetails',
            args: [tokenId],
          }) as RawInvoice;

          if (invoiceDetails) {
            userInvoicePromises.push({
              id: tokenId.toString(),
              invoiceId: invoiceDetails.invoiceId,
              supplier: invoiceDetails.supplier,
              buyer: invoiceDetails.buyer,
              creditAmount: invoiceDetails.creditAmount.toString(),
              dueDate: new Date(Number(invoiceDetails.dueDate) * 1000),
              ipfsHash: invoiceDetails.ipfsHash,
              isVerified: invoiceDetails.isVerified
            });
          }
        } catch (err) {
          console.error('Error processing invoice for tokenId:', log.args.tokenId, err);
        }
      }
      
      // Direct check for the user's invoice that we know exists
      try {
        const directInvoice = await readClient.readContract({
          address: invoiceNFTContract.address,
          abi: invoiceNFTContract.abi,
          functionName: 'getInvoiceDetails',
          args: [BigInt(7)],
        }) as RawInvoice;
        
        
        if (directInvoice && directInvoice.supplier === userAddress) {
          // Add to userInvoices if not already there
          const existingInvoice = userInvoicePromises.find(inv => inv.id === '7');
          if (!existingInvoice) {
            userInvoicePromises.push({
              id: '7',
              invoiceId: directInvoice.invoiceId,
              supplier: directInvoice.supplier,
              buyer: directInvoice.buyer,
              creditAmount: directInvoice.creditAmount.toString(),
              dueDate: new Date(Number(directInvoice.dueDate) * 1000),
              ipfsHash: directInvoice.ipfsHash,
              isVerified: directInvoice.isVerified
            });
          }
        }
      } catch (directErr) {
        console.error('🔍 Direct invoice check failed:', directErr);
      }
      
      // Always try to get all InvoiceMinted events to see what exists
      try {
        const allLogs = await readClient.getLogs({
          address: invoiceNFTContract.address,
          event: {
            type: 'event',
            name: 'InvoiceMinted',
            inputs: [
              { type: 'uint256', name: 'tokenId', indexed: true },
              { type: 'address', name: 'supplier', indexed: true },
              { type: 'string', name: 'invoiceId', indexed: false }
            ]
          },
          fromBlock,
          toBlock: 'latest'
        });
      } catch (fallbackErr) {
        return;
      }
      
      setUserInvoices(userInvoicePromises);
      return userInvoicePromises;
    } catch (err) {
      console.error('Error fetching user invoices:', err);
      
      // Fallback: Try to check for known invoice token IDs directly
      console.log('🔄 Trying fallback approach for invoice detection...');
      try {
        const fallbackInvoices = [];
        
        // Check for common token IDs (1-20) to see if any belong to this user
        for (let tokenId = 1; tokenId <= 20; tokenId++) {
          try {
            const invoiceDetails = await readClient.readContract({
              address: invoiceNFTContract.address,
              abi: invoiceNFTContract.abi,
              functionName: 'getInvoiceDetails',
              args: [BigInt(tokenId)],
            }) as RawInvoice;
            
            if (invoiceDetails && invoiceDetails.supplier.toLowerCase() === userAddress.toLowerCase()) {
              fallbackInvoices.push({
                id: tokenId.toString(),
                invoiceId: invoiceDetails.invoiceId,
                supplier: invoiceDetails.supplier,
                buyer: invoiceDetails.buyer,
                creditAmount: invoiceDetails.creditAmount.toString(),
                dueDate: new Date(Number(invoiceDetails.dueDate) * 1000),
                ipfsHash: invoiceDetails.ipfsHash,
                isVerified: invoiceDetails.isVerified
              });
            }
          } catch (tokenErr) {
            // Token doesn't exist or other error, continue
            continue;
          }
        }
        
        if (fallbackInvoices.length > 0) {
          console.log('✅ Fallback found invoices:', fallbackInvoices.length);
          setUserInvoices(fallbackInvoices);
          setError(null);
          return fallbackInvoices;
        }
      } catch (fallbackErr) {
        console.error('Fallback approach also failed:', fallbackErr);
      }
      
      setError(err as Error);
      setUserInvoices([]);
    } finally {
      setIsLoading(false);
    }
  }, [readClient, invoiceNFTContract.address, invoiceNFTContract.abi]);

  // New function to fetch all user invoices (including burned ones)
  const fetchAllUserInvoices = useCallback(async (userAddress: Address) => {
    
    if (!readClient || !invoiceNFTContract.address || !invoiceNFTContract.abi || !userAddress) {
      setUserInvoices([]);
      return;
    }

    try {
      setIsLoading(true);
      
      // Get all tokens ever minted by this user (including burned ones)
      const userMintedTokens = await readClient.readContract({
        address: invoiceNFTContract.address,
        abi: invoiceNFTContract.abi,
        functionName: 'getUserMintedTokens',
        args: [userAddress],
      }) as bigint[];


      const allUserInvoices: Invoice[] = [];

      // Fetch historical records for each token (works for both active and burned)
      for (const tokenId of userMintedTokens) {
        try {
          const historicalRecord = await readClient.readContract({
            address: invoiceNFTContract.address,
            abi: invoiceNFTContract.abi,
            functionName: 'getHistoricalInvoiceRecord',
            args: [tokenId],
          }) as HistoricalInvoiceRecord;

          if (historicalRecord && historicalRecord.tokenId !== 0n) {
            allUserInvoices.push({
              id: tokenId.toString(),
              invoiceId: historicalRecord.invoiceId,
              supplier: historicalRecord.supplier,
              buyer: historicalRecord.buyer,
              creditAmount: historicalRecord.creditAmount.toString(),
              dueDate: new Date(Number(historicalRecord.dueDate) * 1000),
              ipfsHash: historicalRecord.ipfsHash,
              isVerified: historicalRecord.isVerified,
              // Add burned status for UI display
              isBurned: historicalRecord.isBurned,
              burnTime: historicalRecord.burnTime ? new Date(Number(historicalRecord.burnTime) * 1000) : undefined,
              burnReason: historicalRecord.burnReason
            });
          }
        } catch (err) {
          console.error(`Error fetching historical record for token ${tokenId}:`, err);
        }
      }

      setUserInvoices(allUserInvoices);
      
    } catch (err) {
      console.error('Error fetching all user invoices:', err);
      setError(err as Error);
      setUserInvoices([]);
    } finally {
      setIsLoading(false);
    }
  }, [readClient, invoiceNFTContract.address, invoiceNFTContract.abi]);

  // New function to mint invoice NFT with metadata
  const mintInvoiceNFT = useCallback(async (
    supplier: Address,
    uniqueId: string,
    amount: string,
    dueDate: Date,
    metadata: string
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      const parsedAmount = parseAmount(amount, 6);
      const dueDateTimestamp = BigInt(Math.floor(dueDate.getTime() / 1000));
      if (isPrivy) {
        const data = encodeFunctionData({
          abi: invoiceNFTContract.abi,
          functionName: 'mintInvoiceNFT',
          args: [supplier, uniqueId, parsedAmount, dueDateTimestamp, metadata],
        });
        const hash = await executeTransaction(
          invoiceNFTContract.address,
          data,
          0n,
          publicClient?.chain.id
        );
        if (supplier) {
          await fetchInvoices(supplier);
          await fetchUserInvoices(supplier);
        }
        toast.success('Invoice NFT minted successfully!');
        return hash;
      }
      if (!walletClient || !currentAddress || !publicClient) {
        throw new Error('Wallet client, address, or public client not available.');
      }
      const { request } = await publicClient.simulateContract({
        account: currentAddress,
        address: invoiceNFTContract.address,
        abi: invoiceNFTContract.abi,
        functionName: 'mintInvoiceNFT',
        args: [supplier, uniqueId, parsedAmount, dueDateTimestamp, metadata],
      });
      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });
      if (currentAddress) {
        await fetchInvoices(currentAddress);
        await fetchUserInvoices(currentAddress);
      }
      toast.success('Invoice NFT minted successfully!');
      return hash;
    } catch (err) {
      console.error('Error minting invoice NFT:', err);
      setError(err as Error);
      toast.error('Error minting invoice NFT. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, currentAddress, publicClient, invoiceNFTContract.address, invoiceNFTContract.abi, isPrivy, executeTransaction, fetchInvoices, fetchUserInvoices]);

  // New function to verify invoice
  const verifyInvoice = useCallback(async (tokenId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      if (isPrivy) {
        const data = encodeFunctionData({
          abi: invoiceNFTContract.abi,
          functionName: 'verifyInvoice',
          args: [BigInt(tokenId)],
        });
        const { hash } = await sendTransaction({
          to: invoiceNFTContract.address,
          data,
          value: 0n,
          chainId: publicClient?.chain.id,
        });
        await publicClient?.waitForTransactionReceipt({ hash });
        if (privyWallet?.address) {
          await fetchInvoices(privyWallet.address as `0x${string}`);
        }
        toast.success('Invoice verified successfully!');
        return hash;
      }
      if (!walletClient || !currentAddress || !publicClient) {
        throw new Error('Wallet client, address, or public client not available.');
      }
      const { request } = await publicClient.simulateContract({
        account: currentAddress,
        address: invoiceNFTContract.address,
        abi: invoiceNFTContract.abi,
        functionName: 'verifyInvoice',
        args: [BigInt(tokenId)],
      });
      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });
      if (currentAddress) {
        await fetchInvoices(currentAddress);
      }
      toast.success('Invoice verified successfully!');
      return hash;
    } catch (err) {
      console.error('Error verifying invoice:', err);
      setError(err as Error);
      toast.error('Error verifying invoice. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, currentAddress, publicClient, invoiceNFTContract.address, invoiceNFTContract.abi, isPrivy, sendTransaction, fetchInvoices, privyWallet]);

  // New function to get invoice details
  const getInvoiceDetails = useCallback(async (tokenId: string): Promise<InvoiceDetails | null> => {
    try {
      if (!publicClient || !invoiceNFTContract.address || !invoiceNFTContract.abi) {
        return null;
      }

      const result = await publicClient.readContract({
        address: invoiceNFTContract.address,
        abi: invoiceNFTContract.abi,
        functionName: 'getInvoiceDetails',
        args: [BigInt(tokenId)],
      });

      return result as InvoiceDetails;
    } catch (err) {
      console.error('Error fetching invoice details:', err);
      return null;
    }
  }, [publicClient, invoiceNFTContract.address, invoiceNFTContract.abi]);

  const checkVerificationStatus = useCallback(async (tokenId: string) => {
    try {
      if (!publicClient || !invoiceNFTContract.address || !invoiceNFTContract.abi) {
        return false;
      }

      const isVerified = await publicClient.readContract({
        address: invoiceNFTContract.address,
        abi: invoiceNFTContract.abi,
        functionName: 'isVerified',
        args: [tokenId],
      }) as boolean;

      return isVerified;
    } catch (err) {
      console.error('Error checking verification status:', err);
      throw err;
    }
  }, [publicClient, invoiceNFTContract.address, invoiceNFTContract.abi]);

  const hasVerifierRole = useCallback(async (userAddress: Address) => {
    try {
      if (!publicClient || !invoiceNFTContract.address || !invoiceNFTContract.abi) {
        return false;
      }

      const VERIFIER_ROLE = await publicClient.readContract({
        address: invoiceNFTContract.address,
        abi: invoiceNFTContract.abi,
        functionName: 'VERIFIER_ROLE',
      }) as string;

      const hasRole = await publicClient.readContract({
        address: invoiceNFTContract.address,
        abi: invoiceNFTContract.abi,
        functionName: 'hasRole',
        args: [VERIFIER_ROLE, userAddress],
      }) as boolean;

      return hasRole;
    } catch (err) {
      console.error('Error checking verifier role:', err);
      return false;
    }
  }, [publicClient, invoiceNFTContract.address, invoiceNFTContract.abi]);

  const approveInvoice = useCallback(async (tokenId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!walletClient || !currentAddress || !publicClient) {
        throw new Error('Wallet client, address, or public client not available.');
      }

      const { request } = await publicClient.simulateContract({
        account: currentAddress,
        address: invoiceNFTContract.address,
        abi: invoiceNFTContract.abi,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.LENDING_POOL, tokenId],
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });

      return hash;
    } catch (err) {
      console.error('Error approving invoice:', err);
      setError(err as Error);
      toast.error('Error approving invoice. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, currentAddress, publicClient, invoiceNFTContract.address, invoiceNFTContract.abi]);

  const isInvoiceApproved = useCallback(async (tokenId: string) => {
    try {
      if (!publicClient || !invoiceNFTContract.address || !invoiceNFTContract.abi) {
        return false;
      }

      const approvedAddress = await publicClient.readContract({
        address: invoiceNFTContract.address,
        abi: invoiceNFTContract.abi,
        functionName: 'getApproved',
        args: [tokenId],
      }) as string;

      return approvedAddress.toLowerCase() === CONTRACT_ADDRESSES.LENDING_POOL?.toLowerCase();
    } catch (err) {
      console.error('Error checking invoice approval:', err);
      return false;
    }
  }, [publicClient, invoiceNFTContract.address, invoiceNFTContract.abi]);

  // New function to get historical invoice record (including burned ones)
  const getHistoricalInvoiceRecord = useCallback(async (tokenId: string): Promise<HistoricalInvoiceRecord | null> => {
    try {
      if (!readClient || !invoiceNFTContract.address || !invoiceNFTContract.abi) {
        return null;
      }

      const record = await readClient.readContract({
        address: invoiceNFTContract.address,
        abi: invoiceNFTContract.abi,
        functionName: 'getHistoricalInvoiceRecord',
        args: [BigInt(tokenId)],
      }) as HistoricalInvoiceRecord;

      return record;
    } catch (err) {
      console.error('Error fetching historical invoice record:', err);
      return null;
    }
  }, [readClient, invoiceNFTContract.address, invoiceNFTContract.abi]);

  // New function to get user invoice statistics
  const getUserInvoiceStatistics = useCallback(async (userAddress: Address): Promise<UserInvoiceStatistics | null> => {
    try {
      if (!readClient || !invoiceNFTContract.address || !invoiceNFTContract.abi) {
        return null;
      }

      const stats = await readClient.readContract({
        address: invoiceNFTContract.address,
        abi: invoiceNFTContract.abi,
        functionName: 'getUserInvoiceStatistics',
        args: [userAddress],
      }) as UserInvoiceStatistics;
      return stats;
    } catch (err) {
      console.error('Error fetching user invoice statistics:', err);
      return null;
    }
  }, [readClient, invoiceNFTContract.address, invoiceNFTContract.abi]);

  // New function to get all tokens minted by user
  const getUserMintedTokens = useCallback(async (userAddress: Address): Promise<bigint[]> => {
    try {
      if (!readClient || !invoiceNFTContract.address || !invoiceNFTContract.abi) {
        return [];
      }

      const tokenIds = await readClient.readContract({
        address: invoiceNFTContract.address,
        abi: invoiceNFTContract.abi,
        functionName: 'getUserMintedTokens',
        args: [userAddress],
      }) as bigint[];
      return tokenIds;
    } catch (err) {
      console.error('Error fetching user minted tokens:', err);
      return [];
    }
  }, [readClient, invoiceNFTContract.address, invoiceNFTContract.abi]);

  // New function to get all tokens burned by user
  const getUserBurnedTokens = useCallback(async (userAddress: Address): Promise<bigint[]> => {
    try {
      if (!readClient || !invoiceNFTContract.address || !invoiceNFTContract.abi) {
        return [];
      }

      const tokenIds = await readClient.readContract({
        address: invoiceNFTContract.address,
        abi: invoiceNFTContract.abi,
        functionName: 'getUserBurnedTokens',
        args: [userAddress],
      }) as bigint[];

      return tokenIds;
    } catch (err) {
      console.error('Error fetching user burned tokens:', err);
      return [];
    }
  }, [readClient, invoiceNFTContract.address, invoiceNFTContract.abi]);

  // New function to search invoice by ID (works for burned ones)
  const searchInvoiceById = useCallback(async (invoiceId: string): Promise<HistoricalInvoiceRecord | null> => {
    try {
      if (!readClient || !invoiceNFTContract.address || !invoiceNFTContract.abi) {
        return null;
      }

      const record = await readClient.readContract({
        address: invoiceNFTContract.address,
        abi: invoiceNFTContract.abi,
        functionName: 'searchInvoiceById',
        args: [invoiceId],
      }) as HistoricalInvoiceRecord;
      return record;
    } catch (err) {
      console.error('Error searching invoice by ID:', err);
      return null;
    }
  }, [readClient, invoiceNFTContract.address, invoiceNFTContract.abi]);

  // New function to get user historical records with pagination
  const getUserHistoricalRecords = useCallback(async (
    userAddress: Address, 
    offset: number = 0, 
    limit: number = 10
  ): Promise<HistoricalInvoiceRecord[]> => {
    try {
      if (!readClient || !invoiceNFTContract.address || !invoiceNFTContract.abi) {
        return [];
      }

      const records = await readClient.readContract({
        address: invoiceNFTContract.address,
        abi: invoiceNFTContract.abi,
        functionName: 'getUserHistoricalRecords',
        args: [userAddress, BigInt(offset), BigInt(limit)],
      }) as HistoricalInvoiceRecord[];

      return records;
    } catch (err) {
      console.error('Error fetching user historical records:', err);
      return [];
    }
  }, [readClient, invoiceNFTContract.address, invoiceNFTContract.abi]);

  // Effect to fetch invoices when address changes
  useEffect(() => {
    if (address && typeof address === 'string' && address.length > 0) {
      fetchInvoices(address);
      fetchUserInvoices(address);
    } else {
      setError(new Error('Effect: missing address, not fetching invoices.'));
    }
  }, [address, fetchInvoices, fetchUserInvoices]);

  return {
    isLoading,
    error,
    invoices,
    userInvoices,
    historicalInvoices,
    userStatistics,
    fetchInvoices,
    fetchUserInvoices,
    createInvoice: mintInvoiceNFT, // Renamed to reflect new mint function
    verifyInvoice,
    getInvoiceDetails,
    checkVerificationStatus,
    hasVerifierRole,
    approveInvoice,
    isInvoiceApproved,
    // New functions for historical data
    getHistoricalInvoiceRecord,
    getUserInvoiceStatistics,
    getUserMintedTokens,
    getUserBurnedTokens,
    searchInvoiceById,
    getUserHistoricalRecords,
    fetchAllUserInvoices, // Add the new function to the return object
  };
} 