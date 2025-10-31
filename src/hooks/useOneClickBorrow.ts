import { useCallback, useState } from 'react';
import { useSendTransaction, usePrivy } from '@privy-io/react-auth';
import { toast } from 'react-toastify';
import { usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/config';
import lendingPoolAbi from '@/lib/contracts/abis/LendingPool.json';
import invoiceNFTAbi from '@/lib/contracts/abis/InvoiceNFT.json';
import mockERC20Abi from '@/lib/contracts/abis/MockERC20.json';

export function useOneClickBorrow(wallets?: any[]) {
  const { authenticated } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const publicClient = usePublicClient();
  const [isExecuting, setIsExecuting] = useState(false);

  const executeOneClickBorrow = useCallback(async (
    invoiceId: string,
    amount: string
  ) => {
    if (!authenticated) {
      toast.error('Please login first');
      return;
    }

    if (!wallets || wallets.length === 0) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!invoiceId || !amount) {
      toast.error('Please enter invoice ID and amount');
      return;
    }

    // Prevent duplicate execution
    if (isExecuting) {
      console.log('⚠️ Already executing, skipping duplicate call');
      return;
    }

    setIsExecuting(true);
    
    try {
      // Use the specific privy wallet address, not just the first wallet
      const privyWallet = wallets.find(w => w.walletClientType === 'privy' || (w.meta && w.meta.id === 'io.privy.wallet'));
      const userAddress = privyWallet?.address || wallets[0]?.address;
      
      if (!userAddress) {
        throw new Error('No valid wallet address found');
      }
      
      // Debug: Log all wallet information
      console.log('🔍 Wallet Debug Info:', {
        totalWallets: wallets.length,
        privyWalletFound: !!privyWallet,
        privyWalletAddress: privyWallet?.address,
        firstWalletAddress: wallets[0]?.address,
        selectedUserAddress: userAddress,
        allWalletAddresses: wallets.map(w => ({ address: w.address, type: w.walletClientType }))
      });
      
      // Step 1: Prepare batch transaction on backend
      console.log('🔄 Preparing one-click borrow transaction...');
      console.log('📤 Sending to backend:', { invoiceId, amount, userAddress, amountType: typeof amount });
      const response = await fetch('/api/prepare-batch-borrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          amount,
          userAddress
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to prepare transaction');
      }

      const { batchCalls, summary } = await response.json();
      
      console.log('✅ Batch borrow transaction prepared:', summary);
      console.log('📋 Calls to execute:', batchCalls);

      // Step 2: Show user what will happen (only notification)
      toast.info(
        `🚀 Executing seamless borrow: ${summary.amount} against Invoice ${summary.invoiceId}`,
        { autoClose: 3000 }
      );
      
      // Debug: Log user's current state
      console.log('📊 Debug info before borrowing:', {
        userAddress,
        invoiceId,
        amount: `${amount} MUSD`,
        nftContract: batchCalls[0].to,
        lendingContract: batchCalls[1].to
      });

      const results = [];

      // Step 3: Execute NFT approval transaction (COMPLETELY HIDDEN)
      console.log('🚀 Step 1: Approving Invoice NFT silently...');
      const approvalTx = await sendTransaction(
        {
          to: batchCalls[0].to as `0x${string}`,
          data: batchCalls[0].data as `0x${string}`,
          value: batchCalls[0].value,
        },
        {
          uiOptions: {
            showWalletUIs: false, // COMPLETELY HIDE WALLET UI
          }
        }
      );

      console.log('✅ NFT approval transaction submitted:', approvalTx.hash);
      results.push(approvalTx);

      // CRITICAL FIX: Wait for ACTUAL transaction confirmation like traditional borrow
      console.log('⏳ Waiting for NFT approval to be confirmed...');
      toast.info('⏳ Confirming NFT approval on Mezo Blockchain... This may take 30-60 seconds.', { autoClose: 8000 });
      
      if (publicClient && approvalTx.hash) {
        console.log('⏱️ Waiting for ACTUAL approval transaction confirmation on Mezo Blockchain...');
        console.log('📋 Transaction hash:', approvalTx.hash);
        
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ 
            hash: approvalTx.hash as `0x${string}`,
            timeout: 60000 // 60 second timeout for Mezo Blockchain
          });
          
          console.log('✅ Approval transaction CONFIRMED!', {
            hash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            status: receipt.status,
            gasUsed: receipt.gasUsed?.toString()
          });

          if (receipt.status !== 'success') {
            throw new Error(`Approval transaction failed with status: ${receipt.status}`);
          }

          toast.success('✅ NFT approval confirmed! Proceeding to borrow...', { autoClose: 4000 });
        } catch (waitError) {
          console.error('❌ Error waiting for approval confirmation:', waitError);
          throw new Error(`Approval confirmation failed: ${waitError instanceof Error ? waitError.message : 'Unknown wait error'}`);
        }
      } else {
        console.warn('⚠️ No publicClient available for confirmation wait, falling back to 30 second timeout');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }

      // Step 4: Pre-validation before borrowing
      console.log('🔍 Pre-validation before borrow transaction...');
      try {
        // Check if there's already an active loan for this invoice
        console.log('🔍 Checking if invoice already has an active loan...');
        
        // Check userActiveLoans mapping in the contract (only if publicClient is available)
        if (!publicClient) {
          console.warn('⚠️ PublicClient not available, skipping active loan check');
        } else {
          const hasActiveLoan = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.LENDING_POOL,
            abi: lendingPoolAbi.abi,
            functionName: 'userActiveLoans',
            args: [userAddress, BigInt(invoiceId)],
          });
        
          console.log('📋 Active loan check result:', {
            invoiceId,
            userAddress,
            hasActiveLoan,
            explanation: hasActiveLoan ? '❌ Invoice already has an active loan!' : '✅ No active loan found'
          });
        
          if (hasActiveLoan) {
            throw new Error(`LoanAlreadyExists: Invoice ${invoiceId} already has an active loan. Please repay the existing loan first or use a different invoice.`);
          }

          // Additional comprehensive validation checks
          console.log('🔍 Performing comprehensive invoice validation...');
          
          // Check 1: Invoice ownership
          const invoiceOwner = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.INVOICE_NFT,
            abi: invoiceNFTAbi.abi, // Use correct InvoiceNFT ABI
            functionName: 'ownerOf',
            args: [BigInt(invoiceId)],
          }) as string;
          console.log('👤 Invoice ownership check:', {
            invoiceId,
            actualOwner: invoiceOwner,
            userAddress,
            ownsInvoice: invoiceOwner.toLowerCase() === userAddress.toLowerCase()
          });
          
          if (invoiceOwner.toLowerCase() !== userAddress.toLowerCase()) {
            throw new Error(`NotInvoiceSupplier: You don't own invoice ${invoiceId}. Owner: ${invoiceOwner}, Your address: ${userAddress}`);
          }

          // Check 2: Get max borrow amount for this invoice  
          const maxBorrowAmount = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.LENDING_POOL,
            abi: lendingPoolAbi.abi,
            functionName: 'getMaxBorrowAmount',
            args: [BigInt(invoiceId)],
          }) as bigint;
          // The contract returns maxBorrowAmount in 18-decimal format, convert to MUSD display format
          // The contract returns maxBorrowAmount in 6-decimal format, convert to display format
          const maxBorrowFormatted = (Number(maxBorrowAmount) / 1e6).toString();
          console.log('💰 Borrow amount validation:', {
            invoiceId,
            requestedAmount: amount,
            maxBorrowAmountRaw: maxBorrowAmount.toString(),
            maxBorrowAmountFormatted: maxBorrowFormatted,
            requestedAmountWei: `${amount}000000`,
            maxBorrowAmountWei: maxBorrowAmount.toString(),
            withinLimit: Number(amount) <= Number(maxBorrowFormatted),
            debug: {
              maxBorrowAsNumber: Number(maxBorrowAmount),
              dividedBy1e18: Number(maxBorrowAmount) / 1e18,
              dividedBy1e12: Number(maxBorrowAmount) / 1e12,
              dividedBy1e6: Number(maxBorrowAmount) / 1e6
            }
          });

          if (Number(amount) > Number(maxBorrowFormatted)) {
            throw new Error(`InvalidBorrowAmount: Requested ${amount} MUSD exceeds maximum allowed ${maxBorrowFormatted} MUSD for invoice ${invoiceId}`);
          }

          // Check 3: Invoice verification and expiry 
          const invoiceDetails = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.INVOICE_NFT,
            abi: invoiceNFTAbi.abi,
            functionName: 'getInvoiceDetails',
            args: [BigInt(invoiceId)],
          }) as any;
          
          const currentTimestamp = Math.floor(Date.now() / 1000);
          console.log('📄 Invoice details validation:', {
            invoiceId,
            isVerified: invoiceDetails.isVerified,
            dueDate: new Date(Number(invoiceDetails.dueDate) * 1000).toLocaleString(),
            dueDateTimestamp: Number(invoiceDetails.dueDate),
            currentTimestamp,
            isExpired: Number(invoiceDetails.dueDate) <= currentTimestamp,
            creditAmount: (Number(invoiceDetails.creditAmount) / 1e6).toString()
          });

          if (!invoiceDetails.isVerified) {
            throw new Error(`InvoiceNotVerified: Invoice ${invoiceId} is not verified yet. Wait for verification or contact support.`);
          }

          if (Number(invoiceDetails.dueDate) <= currentTimestamp) {
            throw new Error(`InvoiceExpired: Invoice ${invoiceId} has expired. Due date was ${new Date(Number(invoiceDetails.dueDate) * 1000).toLocaleString()}`);
          }

          // Check 4: Pool liquidity
          const availableLiquidity = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.LENDING_POOL,
            abi: lendingPoolAbi.abi,
            functionName: 'totalDeposits',
            args: [],
          }) as bigint;
          
          const totalBorrowed = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.LENDING_POOL,
            abi: lendingPoolAbi.abi,
            functionName: 'totalBorrowed',
            args: [],
          }) as bigint;

          const actualLiquidity = Number(availableLiquidity) - Number(totalBorrowed);
          const requestedAmountWei = Number(amount) * 1e6;
          
          console.log('💧 Pool liquidity validation:', {
            totalDeposits: (Number(availableLiquidity) / 1e6).toString(),
            totalBorrowed: (Number(totalBorrowed) / 1e6).toString(), 
            availableLiquidity: (actualLiquidity / 1e6).toString(),
            requestedAmount: amount,
            requestedAmountWei,
            sufficientLiquidity: actualLiquidity >= requestedAmountWei
          });

          if (actualLiquidity < requestedAmountWei) {
            throw new Error(`InsufficientLiquidity: Pool only has ${(actualLiquidity / 1e6).toFixed(2)} MUSD available, but you requested ${amount}.`);
          }

          // Check 5: NFT Approval Status (Critical!)
          const approvedAddress = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.INVOICE_NFT,
            abi: invoiceNFTAbi.abi,
            functionName: 'getApproved',
            args: [BigInt(invoiceId)],
          }) as string;
          
          console.log('🔐 NFT approval validation:', {
            invoiceId,
            approvedAddress,
            lendingPoolAddress: CONTRACT_ADDRESSES.LENDING_POOL,
            isApproved: approvedAddress.toLowerCase() === CONTRACT_ADDRESSES.LENDING_POOL.toLowerCase(),
            approvalStatus: approvedAddress === '0x0000000000000000000000000000000000000000' ? 'No approval' : 'Approved to: ' + approvedAddress
          });

          if (approvedAddress.toLowerCase() !== CONTRACT_ADDRESSES.LENDING_POOL.toLowerCase()) {
            throw new Error(`NFTNotApproved: Invoice ${invoiceId} is not approved to LendingPool. Current approval: ${approvedAddress}`);
          }

          // Check 6: Contract MUSD Balance (Critical!)
          const contractMUSDBalance = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.MUSD,
            abi: mockERC20Abi.abi, // Use correct ERC20 ABI for balanceOf
            functionName: 'balanceOf',
            args: [CONTRACT_ADDRESSES.LENDING_POOL],
          }) as bigint;
          
          console.log('💰 Contract MUSD balance validation:', {
            contractAddress: CONTRACT_ADDRESSES.LENDING_POOL,
            contractMUSDBalance: (Number(contractMUSDBalance) / 1e6).toString(),
            requestedAmount: amount,
            requestedAmountWei,
            hasSufficientBalance: Number(contractMUSDBalance) >= requestedAmountWei
          });

          if (Number(contractMUSDBalance) < requestedAmountWei) {
            throw new Error(`ContractInsufficientBalance: LendingPool contract only has ${(Number(contractMUSDBalance) / 1e6).toFixed(2)} MUSD, but you requested ${amount}.`);
          }

          // Check 7: Borrowing Capacity (LTV calculation)
          const borrowingCapacity = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.LENDING_POOL,
            abi: lendingPoolAbi.abi,
            functionName: 'getBorrowingCapacity',
            args: [userAddress],
          }) as bigint;
          
          console.log('📊 Borrowing capacity validation:', {
            userAddress,
            borrowingCapacityBasisPoints: Number(borrowingCapacity),
            borrowingCapacityPercent: (Number(borrowingCapacity) / 100).toString() + '%',
            creditAmount: (Number(invoiceDetails.creditAmount) / 1e6).toString(),
            calculatedMaxBorrow: ((Number(invoiceDetails.creditAmount) * Number(borrowingCapacity)) / 10000 / 1e6).toString()
          });

          if (Number(borrowingCapacity) === 0) {
            throw new Error(`ZeroBorrowingCapacity: Your borrowing capacity is 0%. You may need to stake tokens first.`);
          }

          // FINAL CHECK: Verify user still owns NFT right before transaction
          const currentNFTOwner = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.INVOICE_NFT,
            abi: invoiceNFTAbi.abi,
            functionName: 'ownerOf',
            args: [BigInt(invoiceId)],
          }) as string;
          
          console.log('🔍 FINAL NFT ownership verification before transaction:', {
            invoiceId,
            currentOwner: currentNFTOwner,
            userAddress,
            stillOwnsNFT: currentNFTOwner.toLowerCase() === userAddress.toLowerCase(),
            note: 'This is checked right before sending transaction'
          });

          if (currentNFTOwner.toLowerCase() !== userAddress.toLowerCase()) {
            throw new Error(`NFTOwnershipChanged: You no longer own invoice ${invoiceId}. Current owner: ${currentNFTOwner}`);
          }

          // FINAL CHECK: Decode and log the exact payload being sent to smart contract
          console.log('🔍 COMPLETE TRANSACTION PAYLOAD ANALYSIS:');
          
          const borrowCallData = batchCalls[1].data;
          console.log('📦 Raw transaction payload:', {
            to: batchCalls[1].to,
            data: borrowCallData,
            value: batchCalls[1].value,
            rawDataLength: borrowCallData.length
          });

          // Decode the function call manually to verify the amount
          const functionSelector = borrowCallData.slice(0, 10);
          const params = borrowCallData.slice(10);
          
          if (params.length >= 128) {
            const tokenIdHex = params.slice(0, 64);
            const borrowAmountHex = params.slice(64, 128);
            
            const tokenIdDecimal = BigInt('0x' + tokenIdHex);
            const borrowAmountDecimal = BigInt('0x' + borrowAmountHex);
            
            console.log('🔍 DECODED TRANSACTION PARAMETERS:', {
              tokenId: {
                hex: '0x' + tokenIdHex,
                decimal: tokenIdDecimal.toString(),
                expected: invoiceId
              },
              borrowAmount: {
                hex: '0x' + borrowAmountHex,
                decimal: borrowAmountDecimal.toString(),
                expectedWei: (Number(amount) * 1e6).toString(),
                expectedMUSD: (Number(borrowAmountDecimal) / 1e6).toString() + ' MUSD',
                sentAsMUSD: (Number(amount)).toString() + ' MUSD'
              }
            });
          }

          // Decode the function call manually
          console.log('🔧 Function call breakdown:', {
            functionSelector: functionSelector,
            expectedFunction: 'depositInvoiceAndBorrow(uint256,uint256)',
            parametersHex: params,
            parametersLength: params.length
          });
          
          console.log('🔧 Function call breakdown:', {
            functionSelector: functionSelector,
            expectedFunction: 'depositInvoiceAndBorrow(uint256,uint256)',
            parametersHex: params,
            parametersLength: params.length
          });

          // Log complete contract state at execution time
          console.log('📋 COMPLETE CONTRACT STATE AT EXECUTION:', {
            contractAddress: batchCalls[1].to,
            userAddress,
            invoiceId,
            amount,
            timestamp: new Date().toISOString(),
            blockEstimate: 'Will be determined at execution',
            transactionDetails: {
              from: userAddress,
              to: batchCalls[1].to,
              data: borrowCallData,
              value: '0x0'
            }
          });

          console.log('⚠️ This is the EXACT payload being sent to the smart contract. If this fails, the issue is in the contract logic or state.');
          
          // Double-check the max borrow amount right before simulation
          try {
            const currentMaxBorrow = await publicClient.readContract({
              address: CONTRACT_ADDRESSES.LENDING_POOL,
              abi: lendingPoolAbi.abi,
              functionName: 'getMaxBorrowAmount',
              args: [BigInt(invoiceId)],
            }) as bigint;
            
            console.log('🔍 FINAL MAX BORROW AMOUNT CHECK:', {
              invoiceId,
              currentMaxBorrow: currentMaxBorrow.toString(),
              requestedAmount: (Number(amount) * 1e6).toString(),
              requestedAmountMUSD: amount,
              maxBorrowMUSD: (Number(currentMaxBorrow) / 1e6).toString(),
              withinLimit: Number(amount) * 1e6 <= Number(currentMaxBorrow)
            });
          } catch (maxBorrowError) {
            console.error('❌ Error checking max borrow amount:', maxBorrowError);
          }
          
          try {
            // Simulate the call with current state
            console.log('🧪 ATTEMPTING CONTRACT SIMULATION...');
            
            const simulationResult = await publicClient.simulateContract({
              address: batchCalls[1].to as `0x${string}`,
              abi: lendingPoolAbi.abi,
              functionName: 'depositInvoiceAndBorrow',
              args: [BigInt(invoiceId), BigInt(Number(amount) * 1e6)], // Use 6 decimals (MUSD format)
              account: userAddress as `0x${string}`
            });
            
            console.log('✅ CONTRACT SIMULATION SUCCESSFUL:', simulationResult);
          } catch (simError) {
            console.error('❌ CONTRACT SIMULATION FAILED:', simError);
            
            // Extract more detailed error information
            if (simError instanceof Error) {
              console.error('🔍 Detailed simulation error analysis:', {
                errorMessage: simError.message,
                errorName: simError.name,
                stack: simError.stack?.substring(0, 500)
              });
              
              // Check for specific contract errors
              if (simError.message.includes('InsufficientBalance')) {
                throw new Error('SIMULATION: Insufficient balance in lending pool contract');
              } else if (simError.message.includes('InvalidBorrowAmount')) {
                throw new Error('SIMULATION: Borrow amount exceeds maximum allowed');
              } else if (simError.message.includes('LoanAlreadyExists')) {
                throw new Error('SIMULATION: Loan already exists for this invoice (hidden state)');
              } else if (simError.message.includes('NotInvoiceSupplier')) {
                throw new Error('SIMULATION: You are not the supplier of this invoice (hidden state)');
              } else if (simError.message.includes('InvoiceNotVerified')) {
                throw new Error('SIMULATION: Invoice not verified (hidden state)');
              } else if (simError.message.includes('InvoiceExpired')) {
                throw new Error('SIMULATION: Invoice has expired (hidden state)');
              }
            }
            
            console.warn('⚠️ Simulation failed but proceeding anyway - this might be a simulation issue, not a real contract issue');
          }
        }
        
        console.log('✅ Pre-validation passed, proceeding with borrow...');
      } catch (validationError) {
        console.error('❌ Pre-validation failed:', validationError);
        throw validationError; // Re-throw to be caught by the main error handler
      }

      // Step 5: Execute borrow transaction (COMPLETELY HIDDEN)
      console.log('🚀 Step 2: Borrowing MUSD silently...');
      console.log('📊 Borrow transaction details:', {
        to: batchCalls[1].to,
        data: batchCalls[1].data,
        value: batchCalls[1].value,
        invoiceId,
        amount: `${amount} MUSD`,
        userAddress
      });
      
      let borrowTx;
      try {
        borrowTx = await sendTransaction(
          {
            to: batchCalls[1].to as `0x${string}`,
            data: batchCalls[1].data as `0x${string}`,
            value: batchCalls[1].value,
          },
          {
            uiOptions: {
              showWalletUIs: false, // COMPLETELY HIDE WALLET UI
            }
          }
        );
      } catch (borrowError) {
        console.error('❌ BORROW TRANSACTION FAILED:', borrowError);
        
        // Detailed error analysis
        const errorDetails = {
          invoiceId,
          amount,
          errorMessage: borrowError instanceof Error ? borrowError.message : 'Unknown error',
          errorType: borrowError instanceof Error ? borrowError.name : 'Unknown',
          timestamp: new Date().toLocaleString(),
          transactionData: {
            to: batchCalls[1].to,
            data: batchCalls[1].data,
            value: batchCalls[1].value,
            decodedAmount: (Number(amount) * 1e18).toString(),
            userAddress
          },
          contractState: {
            lendingPoolAddress: batchCalls[1].to,
            invoiceNFTAddress: batchCalls[0].to,
            network: 'Mezo Blockchain'
          }
        };
        
        console.error('🔍 Detailed borrow failure analysis:', errorDetails);
        
        // Show user-friendly error
        let userMessage = 'Borrowing failed. ';
        if (borrowError instanceof Error) {
          if (borrowError.message.includes('insufficient')) {
            userMessage += 'Insufficient funds or borrowing capacity.';
          } else if (borrowError.message.includes('reverted')) {
            userMessage += 'Transaction reverted. Please check your invoice and try again.';
          } else {
            userMessage += borrowError.message;
          }
        } else {
          userMessage += 'Please try again.';
        }
        
        throw new Error(userMessage);
      }

      console.log('✅ Borrow completed silently:', borrowTx.hash);
      results.push(borrowTx);

      // Success feedback with all details
      toast.success(
        `🎉 SEAMLESS BORROWING COMPLETED! 
        💰 Amount: ${summary.amount}
        📄 Invoice: ${summary.invoiceId}
        🔗 NFT Approval: ${approvalTx.hash.slice(0, 8)}...
        🔗 Borrow: ${borrowTx.hash.slice(0, 8)}...
        ✨ Zero user interaction required!`,
        { 
          autoClose: 10000,
          onClick: () => {
            window.open(`https://explorer.test.mezo.org/tx/${borrowTx.hash}`, '_blank');
          }
        }
      );

      // Also show a separate toast for easier clicking
      toast.info(
        `🔍 View on Explorer: ${borrowTx.hash.slice(0, 12)}...`,
        {
          autoClose: 8000,
          onClick: () => {
            window.open(`https://explorer.test.mezo.org/tx/${borrowTx.hash}`, '_blank');
          }
        }
      );

      // Show additional success information
      toast.success(
        `💡 Borrowing Tips:
        • Your MUSD has been transferred to your wallet
        • The invoice NFT is now held as collateral
        • You can repay anytime before the due date
        • Interest will accrue daily`,
        { autoClose: 12000 }
      );

      setIsExecuting(false);
      
      return {
        success: true,
        approvalHash: approvalTx.hash,
        borrowHash: borrowTx.hash,
        summary
      };

    } catch (error) {
      console.error('❌ Seamless borrowing failed:', error);
      setIsExecuting(false);
      
              // Log detailed error analysis
        const now = new Date();
        console.error('🔍 Detailed borrow failure analysis:', {
          invoiceId,
          amount,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorType: error instanceof Error && error.message.includes('EstimateGasExecutionError') ? 'Gas estimation failed' : 'Runtime error',
          timestamp: now.toLocaleString(), // More readable timestamp format
          timestampISO: now.toISOString()
        });
      
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          toast.warn('Seamless borrowing cancelled');
        } else if (error.message.includes('insufficient funds')) {
          toast.error('Insufficient funds for borrowing');
        } else if (error.message.includes('vd') || error.message.includes('execution reverted')) {
          toast.error(
            `❌ Borrowing transaction failed! 
            💡 Possible causes:
            • Insufficient MUSD balance
            • Invoice not verified
            • Contract validation failed
            🏠 Try: Go to Home page → Claim more tokens
            🔄 Or use traditional borrowing method below`,
            { autoClose: 12000 }
          );
        } else {
          toast.error(`Seamless borrowing failed: ${error.message}`);
        }
      } else {
        toast.error('Seamless borrowing failed. Please try again.');
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

    } finally {
      setIsExecuting(false);
    }
  }, [authenticated, wallets, sendTransaction]);

  return {
    executeOneClickBorrow,
    isExecuting
  };
} 