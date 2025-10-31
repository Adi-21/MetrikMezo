// Fallback implementation when @privy-io/server-auth is not installed
let PrivyClient: any = null;
let privyServer: any = null;

// Use dynamic import to avoid require issues
async function initializePrivyServer() {
  try {
    console.log('Attempting to import @privy-io/server-auth...');
    const { PrivyClient: PC } = await import('@privy-io/server-auth');
    PrivyClient = PC;
    console.log('Successfully imported PrivyClient');
    
    // Better environment variable debugging
    const appSecret = process.env.PRIVY_APP_SECRET;
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    
    console.log('Environment check:', {
      hasAppSecret: !!appSecret,
      appSecretLength: appSecret?.length || 0,
      appSecretPrefix: appSecret?.substring(0, 10) + '...',
      hasAppId: !!appId,
      appId: appId,
      nodeEnv: process.env.NODE_ENV,
    });
    
    if (!appSecret) {
      console.error('❌ PRIVY_APP_SECRET not found in environment variables');
      console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('PRIVY')));
      throw new Error('PRIVY_APP_SECRET not configured. Session signers will not work.');
    }

    if (!appId) {
      console.error('❌ NEXT_PUBLIC_PRIVY_APP_ID not found in environment variables');
      throw new Error('NEXT_PUBLIC_PRIVY_APP_ID not configured. Session signers will not work.');
    }
    
    console.log('✅ Creating PrivyClient with app ID:', appId);
    privyServer = new PrivyClient({
      appId: appId,
      appSecret: appSecret,
    });
    console.log('✅ Session signers initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing Privy server:', error);
    
    if (error instanceof Error && error.message.includes('Cannot resolve module')) {
      console.warn('📦 @privy-io/server-auth not installed. Session signers will not work.');
      console.warn('To enable session signers, run: npm install @privy-io/server-auth');
    }
    
    console.warn('Environment variables needed:');
    console.warn('- PRIVY_APP_SECRET (from Privy Dashboard)');
    console.warn('- NEXT_PUBLIC_PRIVY_APP_ID (your app ID)');
    return false;
  }
}

// Initialize on module load
let initializationPromise: Promise<boolean> | null = null;

function getInitializationPromise() {
  if (!initializationPromise) {
    initializationPromise = initializePrivyServer();
  }
  return initializationPromise;
}

// Types for session signer functionality
export interface SessionSignerWallet {
  address: string;
  chainId: number;
  delegated: boolean;
}

export interface TransactionRequest {
  to: string;
  data: string;
  value?: string;
  chainId?: number;
}

export interface BatchTransactionRequest {
  transactions: TransactionRequest[];
  chainId?: number;
}

// Get user's wallets with session signers
export async function getUserSessionSignerWallets(identityToken: string): Promise<SessionSignerWallet[]> {
  const isInitialized = await getInitializationPromise();
  
  if (!isInitialized || !privyServer) {
    throw new Error('Session signers not available. Please install @privy-io/server-auth and configure PRIVY_APP_SECRET.');
  }

  try {
    console.log('Getting user with identity token...');
    const user = await privyServer.getUser({ identityToken });
    console.log('User retrieved successfully, checking linked accounts...');
    
    // Filter for wallets with session signers (delegated = true)
    const walletsWithSessionSigners = user.linkedAccounts.filter(
      (account: any): account is any => 
        account.type === 'wallet' && account.delegated === true
    );

    console.log('Found wallets with session signers:', walletsWithSessionSigners.length);
    console.log('All linked accounts:', user.linkedAccounts.map((acc: any) => ({
      type: acc.type,
      delegated: acc.delegated,
      address: acc.address
    })));

    return walletsWithSessionSigners.map((wallet: any) => ({
      address: wallet.address,
      chainId: wallet.chainId || 31611, // Default to Mezo Testnet
      delegated: wallet.delegated,
    }));
  } catch (error) {
    console.error('Error getting session signer wallets:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        throw new Error('Authentication failed. Please ensure the user is properly authenticated with Privy.');
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        throw new Error('Access denied. Please ensure session signers are enabled in your Privy dashboard.');
      } else if (error.message.includes('404') || error.message.includes('Not Found')) {
        throw new Error('User not found. Please ensure the identity token is valid.');
      }
    }
    
    throw new Error(`Failed to get session signer wallets: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Sign a single transaction using session signer
export async function signTransactionWithSessionSigner(
  identityToken: string,
  transaction: TransactionRequest
): Promise<{ hash: string; success: boolean }> {
  const isInitialized = await getInitializationPromise();
  
  if (!isInitialized || !privyServer) {
    throw new Error('Session signers not available. Please install @privy-io/server-auth and configure PRIVY_APP_SECRET.');
  }

  try {
    console.log('Getting session signer wallets for user...');
    const wallets = await getUserSessionSignerWallets(identityToken);
    console.log('Found wallets with session signers:', wallets);
    
    if (wallets.length === 0) {
      throw new Error('No session signer wallets found for user. Please enable session signers in your Privy dashboard and add session signers to the user wallet.');
    }

    // Use the first available session signer wallet
    const wallet = wallets[0];
    console.log('Using wallet for signing:', wallet);
    
    console.log('Signing transaction with Privy server...');
    console.log('Transaction details:', {
      to: transaction.to,
      data: transaction.data,
      value: transaction.value || '0x0',
      chainId: transaction.chainId || wallet.chainId,
    });
    
    // Sign transaction using Privy's server-side signing
    const result = await privyServer.signTransaction({
      identityToken,
      walletAddress: wallet.address,
      chainId: transaction.chainId || wallet.chainId,
      transaction: {
        to: transaction.to,
        data: transaction.data,
        value: transaction.value || '0x0',
      },
    });
    console.log('Privy server signing result:', result);

    return {
      hash: result.hash,
      success: true,
    };
  } catch (error) {
    console.error('Error signing transaction with session signer:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('No session signer wallets found')) {
        throw error; // Re-throw our specific error
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        throw new Error('Authentication failed. Please ensure the user is properly authenticated with Privy.');
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        throw new Error('Access denied. Please ensure session signers are enabled in your Privy dashboard.');
      } else if (error.message.includes('insufficient funds')) {
        throw new Error('Insufficient funds in wallet for transaction.');
      } else if (error.message.includes('gas')) {
        throw new Error('Gas estimation failed. Please check transaction parameters.');
      }
    }
    
    throw new Error(`Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Sign multiple transactions in batch
export async function signBatchTransactionsWithSessionSigner(
  identityToken: string,
  batchRequest: BatchTransactionRequest
): Promise<{ hash: string; success: boolean }[]> {
  const isInitialized = await getInitializationPromise();
  
  if (!isInitialized || !privyServer) {
    throw new Error('Session signers not available. Please install @privy-io/server-auth and configure PRIVY_APP_SECRET.');
  }

  try {
    const wallets = await getUserSessionSignerWallets(identityToken);
    
    if (wallets.length === 0) {
      throw new Error('No session signer wallets found for user. Please enable session signers in your Privy dashboard and add session signers to the user wallet.');
    }

    const wallet = wallets[0];
    const results = [];

    for (const transaction of batchRequest.transactions) {
      try {
        const result = await signTransactionWithSessionSigner(identityToken, {
          ...transaction,
          chainId: transaction.chainId || batchRequest.chainId || wallet.chainId,
        });
        results.push(result);
      } catch (error) {
        results.push({ hash: '', success: false });
        console.error('Error in batch transaction:', error);
      }
    }

    return results;
  } catch (error) {
    console.error('Error signing batch transactions:', error);
    throw error;
  }
} 