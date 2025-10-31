import React, { useState } from 'react';
import { useBorrow } from '@/hooks/useBorrow';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, DollarSign, TrendingUp, Clock, AlertTriangle, CheckCircle, Shield, Target, CreditCard } from 'lucide-react';
import { toast } from 'react-toastify';
import { useWallets } from '@privy-io/react-auth';
import { usePublicClient, useWalletClient } from 'wagmi';
import { encodeFunctionData } from 'viem';
import { useSendTransaction } from '@privy-io/react-auth';
import { useOneClickBorrow } from '@/hooks/useOneClickBorrow';

// Debug: confirm component is rendering
console.log('BorrowInterface rendered');

// Define the Invoice type for prop typing (move outside the component)
type Invoice = {
  id: string | number;
  invoiceId: string;
  supplier: string;
  isVerified: boolean;
  creditAmount?: string | number;
  amount?: string | number;
  dueDate?: string | number;
};

export function BorrowInterface({ invoices }: { invoices: Invoice[] }) {
  const { wallets } = useWallets();
  const privyWallet = wallets.find(w => w.walletClientType === 'privy' || (w.meta && w.meta.id === 'io.privy.wallet'));
  const address = privyWallet?.address;
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { sendTransaction } = useSendTransaction();
  
  // One-click borrowing hook
  const { executeOneClickBorrow, isExecuting } = useOneClickBorrow(wallets);
  
  // Keep legacy state for traditional function compatibility
  const [isBorrowing, setIsBorrowing] = useState(false);
  const {
    userLoans,
    isLoading,
    error,
    borrow,
    animatedStats,
    // New functions and state from updated hook
    getBorrowingCapacity,
    borrowingCapacity,
    safeLendingAmount,
    getUserLoansRaw,
    getLoanByIdRaw,
    getMaxBorrowAmount,
  } = useBorrow(address);

  const [borrowForm, setBorrowForm] = useState({
    invoiceId: '',
    amount: '',
  });

  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  // Add state to track selected invoice for detail card
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedMaxBorrow, setSelectedMaxBorrow] = useState<string>('');
  const [borrowTxHash, setBorrowTxHash] = useState<string>('');

  // Calculate true borrowing capacity and utilization
  const activeLoanInvoiceIds = React.useMemo(() =>
    userLoans
      .filter(loan => loan.status === 'active')
      .map(loan => loan.invoiceId),
    [userLoans]
  );

  // State to store max borrow amounts fetched from contract
  const [maxBorrowAmounts, setMaxBorrowAmounts] = React.useState<Record<string, string>>({});

  // Fetch max borrow amounts from contract directly
  const fetchMaxBorrowAmounts = React.useCallback(async () => {
    if (!invoices || !getMaxBorrowAmount) return;
    
    console.log('🔍 Fetching max borrow amounts from contract for invoices:', invoices.length);
    
    const amounts: Record<string, string> = {};
    
    for (const invoice of invoices) {
      if (invoice.isVerified && !activeLoanInvoiceIds.includes(String(invoice.id))) {
        try {
          const maxAmount = await getMaxBorrowAmount(String(invoice.id));
          amounts[String(invoice.id)] = maxAmount;
          
          console.log('📊 Contract max borrow amount:', {
            invoiceId: invoice.invoiceId,
            tokenId: invoice.id,
            maxBorrowAmount: maxAmount
          });
        } catch (error) {
          console.error('❌ Error fetching max borrow amount for invoice', invoice.id, error);
          amounts[String(invoice.id)] = '0';
        }
      }
    }
    
    setMaxBorrowAmounts(amounts);
    console.log('✅ All max borrow amounts fetched:', amounts);
  }, [invoices, getMaxBorrowAmount, activeLoanInvoiceIds]);

  // Calculate total borrowing capacity from contract data
  const totalBorrowingCapacity = React.useMemo(() => {
    const total = Object.values(maxBorrowAmounts).reduce((sum, amount) => {
      // amount is already formatted string from formatAmount, so just convert to number
      const numericAmount = Number(amount || 0);
      console.log('🔍 Formatted max borrow amount:', amount, 'for calculation');
      console.log('🔍 Numeric amount:', numericAmount, 'MUSD');
      
      return sum + numericAmount;
    }, 0);
    
    console.log('✅ Total borrowing capacity from contract:', total, 'MUSD');
    return total;
  }, [maxBorrowAmounts]);

  const activeBorrowed = React.useMemo(() =>
    userLoans
      .filter(loan => loan.status === 'active')
      .reduce((sum, loan) => sum + Number(loan.amount), 0),
    [userLoans]
  );

  const utilizationRate = totalBorrowingCapacity > 0 ? (activeBorrowed / totalBorrowingCapacity) * 100 : 0;
  
  const safeLendingMarkerPosition = totalBorrowingCapacity > 0
    ? Math.min((Number(safeLendingAmount) / totalBorrowingCapacity) * 100, 100)
    : 0;

  // Effect to check if invoices are loading or error
  React.useEffect(() => {
    if (!invoices) {
      setInvoicesLoading(true);
      setInvoicesError(null);
    } else if (invoices.length === 0) {
      setInvoicesLoading(false);
      setInvoicesError(null);
    } else {
      setInvoicesLoading(false);
      setInvoicesError(null);
      
      // Debug: Log invoice data to understand format
      console.log('📋 Invoices data loaded:', {
        count: invoices.length,
        sampleInvoice: invoices[0],
        allInvoices: invoices.map(inv => ({
          id: inv.id,
          invoiceId: inv.invoiceId,
          creditAmount: inv.creditAmount,
          isVerified: inv.isVerified,
          supplier: inv.supplier
        }))
      });
    }
  }, [invoices]);

  // Fetch max borrow amounts from contract when invoices change
  React.useEffect(() => {
    if (invoices && invoices.length > 0) {
      fetchMaxBorrowAmounts();
    }
  }, [invoices, fetchMaxBorrowAmounts]);

  // Fetch max borrow amount when invoice detail card is opened
  React.useEffect(() => {
    if (selectedInvoiceId) {
      // Use cached amount if available, otherwise fetch from contract
      if (maxBorrowAmounts[selectedInvoiceId]) {
        setSelectedMaxBorrow(maxBorrowAmounts[selectedInvoiceId]);
      } else {
        getMaxBorrowAmount(selectedInvoiceId).then(val => setSelectedMaxBorrow(val));
      }
    } else {
      setSelectedMaxBorrow('');
    }
  }, [selectedInvoiceId, getMaxBorrowAmount, maxBorrowAmounts]);

  const handleBorrow = async (e: React.FormEvent) => {
    console.log('handleBorrow called');
    e.preventDefault();

    if (!privyWallet || !address) {
      console.error('Privy wallet not connected or address not available:', { privyWallet, address });
      toast.error('Privy wallet not connected.');
      return;
    }
    
    if (!borrowForm.invoiceId || !borrowForm.amount) {
      toast.error('Please fill in all fields');
      return;
    }

    // Debug log for borrow arguments from UI
    console.log('BorrowInterface handleBorrow:', {
      invoiceId: borrowForm.invoiceId,
      amount: borrowForm.amount
    });

    // Pre-borrow checks
    try {
      const tokenId = borrowForm.invoiceId;
      const invoice = invoices.find(inv => String(inv.id) === String(tokenId));
      if (!invoice) {
        toast.error('Invoice not found');
        return;
      }
      // Check approval
      const invoiceNFTAddress = process.env.NEXT_PUBLIC_INVOICE_NFT_ADDRESS;
      const lendingPoolAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_LENDINGPOOL;
      if (!invoiceNFTAddress || !lendingPoolAddress) {
        toast.error('Contract addresses not set');
        return;
      }
      if (!publicClient) {
        toast.error('Public client not available');
        return;
      }
      const approved = await publicClient.readContract({
        address: invoiceNFTAddress as `0x${string}`,
        abi: [
          {
            "inputs": [
              { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
            ],
            "name": "getApproved",
            "outputs": [
              { "internalType": "address", "name": "", "type": "address" }
            ],
            "stateMutability": "view",
            "type": "function"
          }
        ],
        functionName: 'getApproved',
        args: [BigInt(tokenId)]
      });
      if (approved.toLowerCase() !== lendingPoolAddress.toLowerCase()) {
        // Not approved: send approve transaction
        toast.info('Approving invoice NFT for LendingPool contract...');
        setIsBorrowing(true);
        const approveAbi = [
          {
            "inputs": [
              { "internalType": "address", "name": "to", "type": "address" },
              { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
            ],
            "name": "approve",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ];
        if (privyWallet && privyWallet.walletClientType === 'privy') {
          // Use Privy sendTransaction
          const data = encodeFunctionData({
            abi: approveAbi,
            functionName: 'approve',
            args: [lendingPoolAddress as `0x${string}`, BigInt(tokenId)]
          });
          const { hash } = await sendTransaction({
            to: invoiceNFTAddress as `0x${string}`,
            data,
            value: 0n,
            chainId: publicClient?.chain.id,
          });
          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash });
          }
          toast.success('Invoice NFT approved with Privy! Proceeding to borrow...');
        } else if (walletClient) {
          // Use Wagmi walletClient
          const approveTx = await walletClient.writeContract({
            address: invoiceNFTAddress as `0x${string}`,
            abi: approveAbi,
            functionName: 'approve',
            args: [lendingPoolAddress as `0x${string}`, BigInt(tokenId)]
          });
          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash: approveTx });
          }
          toast.success('Invoice NFT approved! Proceeding to borrow...');
        } else {
          toast.error('No wallet client available for approval');
          setIsBorrowing(false);
          return;
        }
      }
      // Check max borrow
      const maxBorrow = await getBorrowingCapacity();
      if (Number(borrowForm.amount) > Number(maxBorrow)) {
        toast.error(`Borrow amount exceeds max allowed (${maxBorrow} MUSD)`);
        setIsBorrowing(false);
        return;
      }
      // Log all relevant state
      console.log('Borrow pre-check:', {
        tokenId,
        borrowAmount: borrowForm.amount,
        invoice,
        isVerified: invoice.isVerified,
        dueDate: 'dueDate' in invoice ? (invoice as any).dueDate : undefined,
        now: Date.now() / 1000,
        maxBorrow,
        approved,
        poolLiquidity: 'Check pool balance if needed'
      });
    } catch (preCheckErr) {
      console.error('Pre-borrow check failed:', preCheckErr);
      toast.error('Pre-borrow check failed. See console for details.');
      setIsBorrowing(false);
      return;
    }

    try {
      setIsBorrowing(true);
      const result = await borrow(borrowForm.invoiceId, borrowForm.amount);
      setBorrowForm({ invoiceId: '', amount: '' });
      toast.success('Borrow successful!');
    } catch (err: any) {
      toast.error(err?.message || 'Borrow failed');
    } finally {
      setIsBorrowing(false);
    }
  };

  // One-click borrow handler
  const handleOneClickBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!borrowForm.invoiceId || !borrowForm.amount) {
      toast.error('Please enter invoice ID and amount');
      return;
    }

    // Validate invoice ownership BEFORE executing
    const invoice = invoices.find(inv => inv.invoiceId === borrowForm.invoiceId || String(inv.id) === borrowForm.invoiceId);
    if (!invoice) {
      toast.error('Invoice not found. Please check the invoice ID.');
      return;
    }
    
    // Check if user is the supplier (owner) of this invoice
    if (invoice.supplier && address && invoice.supplier.toLowerCase() !== address.toLowerCase()) {
      toast.error(
        `❌ Invoice Ownership Error!
        You can only borrow against your own invoices.
        Invoice supplier: ${invoice.supplier}
        Your address: ${address}
        ⚠️ Switch to the correct wallet or select your own invoice.`,
        { autoClose: 12000 }
      );
      return;
    }

    try {
      console.log('🚀 Initiating one-click borrow:', {
        invoiceId: borrowForm.invoiceId,
        amount: borrowForm.amount,
        userAddress: address,
        invoiceSupplier: invoice.supplier,
        ownershipValidated: true
      });
      
      const result = await executeOneClickBorrow(borrowForm.invoiceId, borrowForm.amount);
      
      if (result?.success) {
        console.log('✅ One-click borrowing successful!', result);
        
        // Clear form on success
        setBorrowForm({ invoiceId: '', amount: '' });
        
        // Store transaction hash for success modal
        setBorrowTxHash(result.borrowHash || '');
      }
    } catch (error) {
      console.error('❌ One-click borrowing error:', error);
      toast.error('One-click borrowing failed. Please try again.');
    }
  };

  // Debug: Call getUserLoansRaw directly
  const handleDebugGetUserLoans = async () => {
    if (typeof window !== 'undefined' && getUserLoansRaw) {
      const address = (window as any).ethereum?.selectedAddress;
      if (!address) {
        console.log('No address found in window.ethereum.selectedAddress');
        return;
      }
      try {
        const result = await getUserLoansRaw(address);
        console.log('DEBUG getUserLoansRaw result:', result);
      } catch (err) {
        console.error('DEBUG getUserLoansRaw error:', err);
      }
    }
  };

  // Debug: Call getLoanByIdRaw for each loan ID from getUserLoansRaw
  const handleDebugGetLoanByIdRaw = async () => {
    if (typeof window !== 'undefined' && getUserLoansRaw && getLoanByIdRaw) {
      const address = (window as any).ethereum?.selectedAddress;
      if (!address) {
        console.log('No address found in window.ethereum.selectedAddress');
        return;
      }
      try {
        const ids = await getUserLoansRaw(address) as bigint[];
        console.log('DEBUG getUserLoansRaw result:', ids);
        for (const id of ids) {
          await getLoanByIdRaw(id);
        }
      } catch (err) {
        console.error('DEBUG getLoanByIdRaw error:', err);
      }
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const getLoanStatusBadge = (loan: { status: string }) => {
    if (loan.status === 'repaid') {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Repaid
        </Badge>
      );
    }
    if (loan.status === 'liquidated') {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Liquidated
        </Badge>
      );
    }
    if (loan.status === 'overdue') {
      return (
        <Badge variant="destructive">
          <Clock className="w-3 h-3 mr-1" />
          Overdue
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <TrendingUp className="w-3 h-3 mr-1" />
        Active
      </Badge>
    );
  };

  // Add handler for table borrow button
  const handleTableBorrowClick = (invoiceId: string) => {
    // Validate invoice ownership BEFORE allowing selection
    const invoice = invoices.find(inv => String(inv.id) === invoiceId);
    if (!invoice) {
      toast.error('Invoice not found.');
      return;
    }
    
    // Check if user is the supplier (owner) of this invoice
    if (invoice.supplier && address && invoice.supplier.toLowerCase() !== address.toLowerCase()) {
      toast.error(
        `❌ You can only borrow against your own invoices!
        This invoice belongs to: ${invoice.supplier}
        Your address: ${address}
        ⚠️ Please select an invoice you own.`,
        { autoClose: 10000 }
      );
      return;
    }
    
    setBorrowForm({ invoiceId, amount: '' });
    setSelectedInvoiceId(invoiceId);
  };

  // Add handler to close invoice detail card
  const handleCloseInvoiceDetail = () => {
    setSelectedInvoiceId(null);
    setBorrowForm({ invoiceId: '', amount: '' });
  };

  return (
    <div className="space-y-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Borrowed Card (already correct) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Borrowed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="text-2xl font-bold transition-all duration-800 ease-out">
                ${animatedStats.totalBorrowed}
              </div>
              {isLoading && (
                <div className="ml-2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Current borrowed amount
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Borrowing Capacity</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="text-2xl font-bold transition-all duration-800 ease-out">
                ${totalBorrowingCapacity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              {isLoading && (
                <div className="ml-2 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Total available credit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Safe Lending Amount</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="text-2xl font-bold transition-all duration-800 ease-out">
                ${safeLendingAmount ? Number(safeLendingAmount).toLocaleString() : '0'}
              </div>
              {isLoading && (
                <div className="ml-2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              This is the system-wide safe lending amount available for all users (MUSD).
            </p>
          </CardContent>
        </Card>
        {/* Active Loans Card (already correct) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="text-2xl font-bold transition-all duration-800 ease-out">
                {animatedStats.activeLoans}
              </div>
              {isLoading && (
                <div className="ml-2 w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Current active loans
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Borrow Utilization */}
      <Card>
        <CardHeader>
          <CardTitle>Borrow Utilization</CardTitle>
          <CardDescription>
            Your current borrowing utilization rate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="font-medium">Utilization Rate</span>
              <span className="font-bold text-lg">{utilizationRate.toFixed(1)}%</span>
            </div>
            <div className="relative h-8 flex items-center" style={{ minHeight: 32 }}>
              {/* Progress Bar Background */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-3 bg-gray-200 rounded-full w-full z-0" />
              {/* Progress Bar Foreground */}
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-3 bg-indigo-500 rounded-full z-10 transition-all"
                style={{ width: `${Math.min(utilizationRate, 100)}%` }}
              />
              {/* Conditional Safe Limit Display */}
              {Number(safeLendingAmount) > totalBorrowingCapacity ? (
                // System can safely provide loans - show positive message
                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2 z-20">
                  <div className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium border border-green-300">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>System can safely provide loans</span>
                  </div>
                </div>
              ) : (
                // Safe Limit Marker (when safe lending amount is within capacity)
                <div
                  className="absolute flex flex-col items-center z-20"
                  style={{ left: `calc(${safeLendingMarkerPosition}% - 1px)` }}
                  title={`System Safe Lending Limit: $${Number(safeLendingAmount).toLocaleString()}`}
                >
                  <div className="mb-1 text-xs text-yellow-600 font-semibold whitespace-nowrap bg-white px-1 rounded shadow border border-yellow-300">Safe Limit</div>
                  <div className="w-0 h-4 border-l-2 border-dashed border-yellow-500" />
                </div>
              )}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{activeBorrowed.toLocaleString()} MUSD borrowed</span>
              <span>{totalBorrowingCapacity.toLocaleString()} MUSD capacity</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Borrow Positions & History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Active Borrow Positions */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Active Borrow Positions</CardTitle>
            <CardDescription>Your currently open loans</CardDescription>
          </CardHeader>
          <CardContent>
            {userLoans.filter(loan => loan.status === 'active').length === 0 ? (
              <div className="text-muted-foreground text-center py-4">No active borrow positions.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice ID</TableHead>
                    <TableHead>Borrowed</TableHead>
                    <TableHead>Interest</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userLoans.filter(loan => loan.status === 'active').map((loan) => (
                    <TableRow key={loan.invoiceId}>
                      <TableCell>#{loan.invoiceId}</TableCell>
                      <TableCell>${loan.amount}</TableCell>
                      <TableCell>${loan.interestAccrued}</TableCell>
                      <TableCell>{formatDate(loan.dueDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        {/* Borrow History */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Borrow History</CardTitle>
            <CardDescription>All your past borrow actions</CardDescription>
          </CardHeader>
          <CardContent>
            {userLoans.length === 0 ? (
              <div className="text-muted-foreground text-center py-4">No borrow history found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice ID</TableHead>
                    <TableHead>Borrowed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Borrowed On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userLoans.map((loan) => (
                    <TableRow key={loan.invoiceId}>
                      <TableCell>#{loan.invoiceId}</TableCell>
                      <TableCell>${loan.amount}</TableCell>
                      <TableCell>{getLoanStatusBadge(loan)}</TableCell>
                      <TableCell>{formatDate(loan.borrowTime)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="borrow" className="space-y-4">
        <TabsList>
          <TabsTrigger value="borrow">Borrow</TabsTrigger>
          <TabsTrigger value="my-loans">My Loans</TabsTrigger>
        </TabsList>

        <TabsContent value="borrow" className="space-y-4">
          {/* Borrow Against Invoice card removed as requested */}
        </TabsContent>

        <TabsContent value="my-loans" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Loans</CardTitle>
                  <CardDescription>
                    Your current and past loans
                  </CardDescription>
                </div>
                {isLoading && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Updating...
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {userLoans && userLoans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {isLoading ? 'Loading your loans...' : 'No loans found. Borrow against your invoices above.'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice ID</TableHead>
                      <TableHead>Borrowed Amount</TableHead>
                      <TableHead>Interest</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Days Left</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userLoans.map((loan) => (
                      <TableRow key={loan.invoiceId}>
                        <TableCell className="font-mono text-sm">
                          #{loan.invoiceId}
                        </TableCell>
                        <TableCell>${loan.amount}</TableCell>
                        <TableCell>${loan.interestAccrued}</TableCell>
                        <TableCell>{formatDate(loan.dueDate)}</TableCell>
                        <TableCell>
                          {getLoanStatusBadge(loan)}
                        </TableCell>
                        <TableCell>
                          {loan.dueDate > new Date() ? (
                            <span className="text-sm">
                              {Math.ceil((loan.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                            </span>
                          ) : (
                            <span className="text-sm text-red-600">Overdue</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Enhanced Seamless Borrowing Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Seamless Borrowing</span>
            <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full font-normal">
              ⚡ Zero-Click Available
            </span>
          </CardTitle>
          <CardDescription>
            Borrow MUSD against your verified invoices with zero wallet prompts. The platform handles NFT approval and borrowing automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Seamless Borrow Benefits Info */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200 mb-4">
            <h4 className="text-sm font-semibold text-green-900 mb-2">⚡ Why Use Seamless Borrowing?</h4>
            <ul className="text-xs text-green-800 space-y-1">
              <li>• <strong>Zero-Click:</strong> No wallet confirmations or approval prompts</li>
              <li>• <strong>Automatic NFT Approval:</strong> Invoice NFT approval handled in background</li>
              <li>• <strong>Instant Borrowing:</strong> MUSD transferred to your wallet immediately</li>
              <li>• <strong>Perfect UX:</strong> Users don&apos;t need blockchain knowledge</li>
            </ul>
          </div>

          {/* Seamless Execution Progress */}
          {isExecuting && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-lg border border-amber-200 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-amber-900">⚡ Seamless Execution in Progress</h4>
                  <p className="text-xs text-amber-800 mt-1">
                    Running NFT approval + borrowing in background... No action needed from you!
                  </p>
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-amber-700">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Step 1: Invoice NFT approval transaction submitted</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-amber-700">
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                      <span>Step 2: Processing borrowing transaction</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleOneClickBorrow} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="seamlessInvoiceId">Select Invoice</Label>
                <select
                  id="seamlessInvoiceId"
                  value={borrowForm.invoiceId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBorrowForm(prev => ({ ...prev, invoiceId: e.target.value }))}
                  required
                  disabled={isExecuting}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 text-black"
                >
                  <option value="">Select a verified invoice...</option>
                  {invoices
                    .filter(inv => inv.isVerified && !activeLoanInvoiceIds.includes(String(inv.id)))
                    .map(inv => (
                      <option key={inv.id} value={String(inv.id)}>
                        {inv.invoiceId} - ${inv.creditAmount != null ? (Number(inv.creditAmount) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 }) : inv.amount != null ? inv.amount : 'N/A'} MUSD
                      </option>
                    ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Choose from your verified invoices
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seamlessAmount">Borrow Amount (MUSD)</Label>
                <Input
                  id="seamlessAmount"
                  placeholder="1000"
                  value={borrowForm.amount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBorrowForm(prev => ({ ...prev, amount: e.target.value }))}
                  required
                  disabled={isExecuting}
                />
                <p className="text-xs text-muted-foreground">
                  Amount of MUSD to borrow against the invoice
                </p>
              </div>
            </div>
            <Button 
              type="submit" 
              disabled={isExecuting} 
              className="w-full font-bold rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-2 px-4 shadow focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ⚡ Processing Seamlessly...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  ⚡ SEAMLESS BORROW (Zero-Click)
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Quick Borrow from Invoice Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Quick Borrow from Invoices</CardTitle>
              <CardDescription>
                Click &quot;Borrow&quot; on any verified invoice for instant seamless borrowing
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              ⚡ Seamless
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>INVOICE ID</TableHead>
                <TableHead>AMOUNT</TableHead>
                <TableHead>DUE DATE</TableHead>
                <TableHead>STATUS</TableHead>
                <TableHead>ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.filter(inv => inv.isVerified).map(inv => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.invoiceId}</TableCell>
                  <TableCell>{inv.creditAmount != null ? (Number(inv.creditAmount) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 }) : inv.amount != null ? inv.amount : 'N/A'} MUSD</TableCell>
                  <TableCell>{inv.dueDate != null ? new Date(Number(inv.dueDate) * 1000).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant="default">Verified</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="default"
                      onClick={() => handleTableBorrowClick(String(inv.id))}
                      disabled={isExecuting}
                      className="font-bold rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-1 px-3 shadow focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isExecuting ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          ⚡ Borrow
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invoice Detail Card (shown when a table borrow button is clicked) */}
      {selectedInvoiceId && (() => {
        const invoice = invoices.find(inv => String(inv.id) === selectedInvoiceId);
        const isLoanActive = activeLoanInvoiceIds.includes(selectedInvoiceId);

        return (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="relative w-full max-w-full mx-auto bg-white border border-gray-200 shadow-2xl rounded-xl p-8">
              <button
                className="absolute top-4 left-4 text-gray-400 hover:text-indigo-600 focus:outline-none"
                onClick={handleCloseInvoiceDetail}
                disabled={isExecuting}
                aria-label="Back"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <h4 className="text-xl font-semibold text-gray-800 mb-4 text-center">Invoice Details</h4>
              
              {!invoice ? <div>Invoice not found.</div> : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500">Invoice ID</div>
                      <div className="font-mono text-sm">{invoice.invoiceId}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Credit Amount</div>
                      <div className="text-sm">{invoice.creditAmount != null ? (Number(invoice.creditAmount)  / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 }) : invoice.amount != null ? invoice.amount : 'N/A'} MUSD</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Due Date</div>
                                              <div className="text-sm">{invoice.dueDate != null ? new Date(Number(invoice.dueDate)).toLocaleDateString() : 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Status</div>
                      <div className="text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Verified
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Max Borrow Amount</div>
                      <div className="text-lg font-bold text-indigo-700">
                        {isLoanActive 
                          ? '$0.00' 
                          : selectedMaxBorrow 
                            ? `${selectedMaxBorrow} MUSD` 
                            : 'Loading...'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Seamless Borrow form */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200 mb-4">
                    <h4 className="text-sm font-semibold text-green-900 mb-2">⚡ Seamless Borrowing (Zero-Click Experience)</h4>
                    <p className="text-xs text-green-700 mb-3">
                      ✨ Completely automated! NFT approval + borrowing happens in background with ZERO wallet prompts!
                    </p>
                  </div>
                  
                  {/* Seamless Execution Progress */}
                  {isExecuting && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-lg border border-amber-200 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-amber-900">⚡ Seamless Execution in Progress</h4>
                          <p className="text-xs text-amber-800 mt-1">
                            Running NFT approval + borrowing in background... No action needed from you!
                          </p>
                          <div className="mt-3 space-y-1">
                            <div className="flex items-center gap-2 text-xs text-amber-700">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span>Step 1: NFT approval transaction submitted</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-amber-700">
                              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                              <span>Step 2: Waiting for blockchain confirmation (~8 seconds)</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-amber-600">
                              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                              <span>Step 3: Borrowing transaction (pending)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleOneClickBorrow} className="flex flex-col sm:flex-row gap-2 items-end mb-2">
                    <input
                      type="number"
                      className="block w-full max-w-xl rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-2 py-2 text-black"
                      placeholder={isLoanActive ? "Loan already active" : "Enter amount"}
                      min="0"
                      value={borrowForm.amount}
                      onChange={e => setBorrowForm(prev => ({ ...prev, amount: e.target.value }))}
                      disabled={isExecuting || isLoanActive}
                    />
                    <Button
                      type="submit"
                      disabled={isExecuting || !borrowForm.amount || isLoanActive}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
                    >
                      {isExecuting ? '⚡ Processing Seamlessly...' : (isLoanActive ? 'Loan Active' : `⚡ SEAMLESS BORROW ${borrowForm.amount ? `${borrowForm.amount} MUSD` : ''} (Zero-Click)`)}
                    </Button>
                  </form>
                  {isLoanActive && <p className="text-xs text-center text-yellow-600 mt-2">This invoice has an active loan and cannot be borrowed against again.</p>}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Centered Borrow Loader */}
      {isExecuting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-xl max-w-md mx-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  ⚡ Seamless Borrowing
                </h3>
                <p className="text-sm text-gray-600">
                  Please wait while we process your borrow request...
                </p>
                <div className="mt-4 space-y-2 text-xs text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Processing borrow request...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Borrow Success Modal */}
      {borrowTxHash && (
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
                  ✅ Seamless Borrowing Completed!
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Your MUSD has been transferred to your wallet.
                </p>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Transaction Hash:</p>
                  <p className="text-xs font-mono text-gray-800 break-all">
                    {borrowTxHash}
                  </p>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => {
                      window.open(`https://explorer.test.mezo.org/tx/${borrowTxHash}`, '_blank');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
                    size="sm"
                  >
                    🔍 View on Explorer
                  </Button>
                  <Button
                    onClick={() => setBorrowTxHash('')}
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
    </div>
  );
} 