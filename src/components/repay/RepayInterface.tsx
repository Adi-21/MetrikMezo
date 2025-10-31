import React, { useState } from 'react';
import { useRepay } from '@/hooks/useRepay';
import { useOneClickRepay } from '@/hooks/useOneClickRepay';
import { useWallets } from '@privy-io/react-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, DollarSign, CreditCard, Clock, AlertTriangle, CheckCircle, RefreshCw, TrendingUp } from 'lucide-react';
import { toast } from 'react-toastify';
import { Contract } from 'ethers';
import { parseUnits } from 'ethers';
import faucetAbi from '@/lib/contracts/abis/Faucet.json';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useSendTransaction } from '@privy-io/react-auth';

export function RepayInterface() {
  const { wallets } = useWallets();
  const privyWallet = wallets.find(w => w.walletClientType === 'privy' || (w.meta && w.meta.id === 'io.privy.wallet'));
  const address = privyWallet?.address;
  
  // Faucet constants
  const MUSD_ADDRESS = process.env.NEXT_PUBLIC_STABLECOIN_ADDRESS!; // Now MUSD
  const FAUCET_ADDRESS = process.env.NEXT_PUBLIC_FAUCET_ADDRESS!;
  const { refreshBalances, refetchMusdBalance } = useTokenBalance(); // Updated to use MUSD
  const { sendTransaction } = useSendTransaction();
  const {
    outstandingLoans,
    repaymentStats,
    musdBalance,
    isLoading,
    error,
    animatedStats,
    animatedMusdBalance,
    refetch,
  } = useRepay(address);

  const { executeOneClickRepay, isExecuting: isOneClickExecuting } = useOneClickRepay();

  const [repayForm, setRepayForm] = useState({
    invoiceId: '',
  });
  const [isRepaying, setIsRepaying] = useState(false);
  const [repayTxHash, setRepayTxHash] = useState<string>('');
  
  // Faucet state
  const [faucetAmount, setFaucetAmount] = useState('');
  const [isMinting, setIsMinting] = useState(false);

  // Auto-populate form with first available loan
  React.useEffect(() => {
    if (outstandingLoans.length > 0 && !repayForm.invoiceId) {
      const firstLoan = outstandingLoans[0];
      console.log('🔍 Auto-populating form with first loan:', firstLoan.invoiceId);
      setRepayForm({
        invoiceId: firstLoan.invoiceId,
      });
    }
  }, [outstandingLoans, repayForm.invoiceId]);

  // One-click repay handler using seamless transaction
  const handleOneClickRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!repayForm.invoiceId) {
      toast.error('Please select an invoice to repay');
      return;
    }

    try {
      setIsRepaying(true);
      
      // Show user what's happening
      toast.info('🚀 Executing seamless repay: MUSD approval + repayment in background!', { autoClose: 3000 });
      
      console.log('🚀 Initiating one-click repay for invoice:', repayForm.invoiceId);
      
      const result = await executeOneClickRepay(repayForm.invoiceId);
      
      // Reset form
      setRepayForm({
        invoiceId: '',
      });
      
      // Refresh data
      await refetch();
      
      setRepayTxHash(result || '');
    } catch (err) {
      console.error('❌ Seamless repayment failed:', err);
      toast.error('Seamless repayment failed. Please try again.');
    } finally {
      setIsRepaying(false);
    }
  };

  const handleQuickRepay = async (invoiceId: string) => {
    try {
      setIsRepaying(true);
      
      // Show seamless execution message
      toast.info('⚡ Processing seamless repayment...', { autoClose: 3000 });
      
      const result = await executeOneClickRepay(invoiceId);
      
      // Refresh data
      await refetch();
      
      setRepayTxHash(result || '');
    } catch (err) {
      console.error('❌ Quick repay failed:', err);
      toast.error('Seamless repayment failed. Please try again.');
    } finally {
      setIsRepaying(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const getLoanStatusBadge = (loan: { isRepaid: boolean; isLiquidated: boolean; isOverdue: boolean }) => {
    if (loan.isRepaid) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Repaid
        </Badge>
      );
    }
    if (loan.isLiquidated) {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Liquidated
        </Badge>
      );
    }
    if (loan.isOverdue) {
      return (
        <Badge variant="destructive">
          <Clock className="w-3 h-3 mr-1" />
          Overdue
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <CreditCard className="w-3 h-3 mr-1" />
        Active
      </Badge>
    );
  };

  const calculateRepaymentProgress = () => {
    const totalOutstanding = Number(repaymentStats.totalOutstanding) / 1e6;
    const totalRepaid = Number(repaymentStats.totalRepaid) / 1e6;
    const total = totalOutstanding + totalRepaid;
    return total > 0 ? (totalRepaid / total) * 100 : 0;
  };

  // Mint MUSD from faucet
  const handleMintMUSD = async () => {
    if (!address) {
      toast.error('Connect your wallet first.');
      return;
    }
    
    if (!faucetAmount || isNaN(Number(faucetAmount)) || Number(faucetAmount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    setIsMinting(true);
    try {
      // Use Privy wallet instead of window.ethereum
      const decimals = 6;
      const amt = parseUnits(faucetAmount, decimals);
      
      // Create the transaction data for faucet.claim(MUSD_ADDRESS, amt)
      const faucetContract = new Contract(FAUCET_ADDRESS, (faucetAbi as any).abi);
      const claimData = faucetContract.interface.encodeFunctionData('claim', [MUSD_ADDRESS, amt]);
      
      console.log('🚀 Minting MUSD via Privy wallet:', {
        faucetAddress: FAUCET_ADDRESS,
        musdAddress: MUSD_ADDRESS,
        amount: faucetAmount,
        amountWei: amt.toString(),
        userAddress: address
      });
      
      // Send transaction using Privy wallet
      const tx = await sendTransaction(
        {
          to: FAUCET_ADDRESS as `0x${string}`,
          data: claimData as `0x${string}`,
          value: 0n,
        },
        {
          uiOptions: {
            showWalletUIs: false, // Hide wallet UI for seamless experience
          }
        }
      );
      
      console.log('✅ MUSD mint transaction submitted:', tx.hash);
      
      toast.success(`Minted ${faucetAmount} MUSD to your wallet! Transaction: ${tx.hash.slice(0, 8)}...`);
      setFaucetAmount('');
      
      // Refresh balances after successful mint
      setTimeout(() => {
        console.log('🔄 Calling refreshBalances after mint...');
        refreshBalances();
        console.log('🔄 Calling refetchMusdBalance after mint...');
        refetchMusdBalance();
      }, 2000); // Wait 2 seconds for blockchain to update
    } catch (err: unknown) {
      console.error('❌ Mint MUSD failed:', err);
      toast.error((err as Error).message || 'Mint failed');
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Error loading repayment data: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="text-2xl font-bold transition-all duration-800 ease-out">
                ${(Number(animatedStats.totalOutstanding) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              {isLoading && (
                <div className="ml-2 w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Amount to be repaid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MUSD Balance</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="text-2xl font-bold transition-all duration-800 ease-out">
                ${(Number(animatedMusdBalance) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              {isLoading && (
                <div className="ml-2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Available for repayment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Interest</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="text-2xl font-bold transition-all duration-800 ease-out">
                ${(Number(animatedStats.totalInterest) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              {isLoading && (
                <div className="ml-2 w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Accrued interest
            </p>
          </CardContent>
        </Card>

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
              Loans to repay
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Repayment Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Repayment Progress</CardTitle>
          <CardDescription>
            Your overall repayment status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>Repaid: ${(Number(repaymentStats.totalRepaid) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              <span>Total: ${((Number(repaymentStats.totalOutstanding) + Number(repaymentStats.totalRepaid)) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <Progress 
              value={calculateRepaymentProgress()} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground">
              {calculateRepaymentProgress().toFixed(1)}% of total loans repaid
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="repay" className="space-y-4">
        <TabsList>
          <TabsTrigger value="repay">Repay Loan</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding Loans</TabsTrigger>
        </TabsList>

        <TabsContent value="repay" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Repay Loan</span>
                <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full font-normal">
                  ⚡ Zero-Click Available
                </span>
              </CardTitle>
              <CardDescription>
                Seamlessly repay your outstanding loans with MUSD (automatic approval + repayment)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Seamless Repay Benefits Info */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200 mb-4">
                <h4 className="text-sm font-semibold text-green-900 mb-2">⚡ Why Use Seamless Repayment?</h4>
                <ul className="text-xs text-green-800 space-y-1">
                  <li>• <strong>Zero-Click:</strong> No wallet confirmations or prompts</li>
                  <li>• <strong>Instant:</strong> Backend handles MUSD approval automatically</li>
                  <li>• <strong>Seamless:</strong> Approval + repayment in complete background</li>
                  <li>• <strong>Perfect UX:</strong> Users don&apos;t need to understand blockchain complexity</li>
                </ul>
              </div>
              
              {/* Seamless Execution Progress */}
              {(isRepaying || isOneClickExecuting) && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-lg border border-amber-200 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-amber-900">⚡ Seamless Execution in Progress</h4>
                      <p className="text-xs text-amber-800 mt-1">
                        Running MUSD approval + repayment in background... No action needed from you!
                      </p>
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-amber-700">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Step 1: MUSD approval transaction submitted</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-amber-700">
                          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                          <span>Step 2: Processing repayment transaction</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleOneClickRepay} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invoiceId">Select Loan to Repay</Label>
                  {outstandingLoans.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2">
                      No outstanding loans found. You&apos;re all caught up!
                    </div>
                  ) : (
                    <select
                      id="invoiceId"
                      value={repayForm.invoiceId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRepayForm(prev => ({ ...prev, invoiceId: e.target.value }))}
                      required
                      disabled={isRepaying}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-500 disabled:opacity-50"
                    >
                      <option value="">Select a loan...</option>
                      {outstandingLoans.map((loan) => (
                        <option key={loan.invoiceId} value={loan.invoiceId}>
                          Invoice #{loan.invoiceId} - ${(Number(loan.totalAmount) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} (Due: {formatDate(loan.dueDate)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <Button type="submit" disabled={isRepaying || isOneClickExecuting} className="w-full font-bold rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-2 px-4 shadow focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {(isRepaying || isOneClickExecuting) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ⚡ Processing Seamlessly...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      ⚡ SEAMLESS REPAY (Zero-Click)
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outstanding" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Outstanding Loans</CardTitle>
                  <CardDescription>
                    Your loans that need to be repaid
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refetch}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {outstandingLoans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {isLoading ? 'Loading outstanding loans...' : 'No outstanding loans found. You&apos;re all caught up!'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice ID</TableHead>
                      <TableHead>Original Amount</TableHead>
                      <TableHead>Interest</TableHead>
                      <TableHead>Total Due</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outstandingLoans.map((loan) => (
                      <TableRow key={loan.invoiceId}>
                        <TableCell className="font-mono text-sm">
                          #{loan.invoiceId}
                        </TableCell>
                        <TableCell>${(Number(loan.amount) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                        <TableCell>${(Number(loan.interestAccrued) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="font-semibold">${(Number(loan.totalAmount) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                        <TableCell>{formatDate(loan.dueDate)}</TableCell>
                        <TableCell>
                          {getLoanStatusBadge(loan)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickRepay(loan.invoiceId)}
                            disabled={isRepaying || isOneClickExecuting || loan.isRepaid}
                            className="font-bold rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-1 px-3 shadow focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {(isRepaying || isOneClickExecuting) && !loan.isRepaid ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            {loan.isRepaid ? '✅ Repaid' : '⚡ Seamless Repay'}
                          </Button>
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

      {/* MUSD Balance Warning */}
      {parseFloat(musdBalance) < parseFloat(repaymentStats.totalOutstanding) && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your MUSD balance (${musdBalance}) is lower than your outstanding balance (${repaymentStats.totalOutstanding}). 
            You may need to acquire more MUSD to complete your repayments.
          </AlertDescription>
        </Alert>
      )}

      {/* Faucet: Mint MUSD */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Faucet: Mint MUSD
          </CardTitle>
          <CardDescription>
            Need more MUSD for repayments? Mint any amount from the faucet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1">
              <Label htmlFor="faucet-amount" className="text-sm font-medium">
                Amount to Mint
              </Label>
              <Input
                id="faucet-amount"
                type="number"
                min="0"
                step="any"
                placeholder="Enter amount (e.g., 1000)"
                value={faucetAmount}
                onChange={(e) => setFaucetAmount(e.target.value)}
                className="mt-1"
                disabled={isMinting}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleMintMUSD}
                disabled={isMinting || !faucetAmount || Number(faucetAmount) <= 0}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold"
              >
                {isMinting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Minting...
                  </>
                ) : (
                  <>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Mint MUSD
                  </>
                )}
              </Button>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    console.log('🔄 Manual refreshBalances clicked');
                    refreshBalances();
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Refresh Balance
                </Button>
                <Button
                  onClick={() => {
                    console.log('🔄 Manual refetchMusdBalance clicked');
                    refetchMusdBalance();
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Refresh MUSD
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 You can mint any amount of MUSD tokens to your wallet for testing repayments.
          </p>
        </CardContent>
      </Card>

      {/* Centered Repay Loader */}
      {(isRepaying || isOneClickExecuting) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-xl max-w-md mx-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  ⚡ Seamless Repayment
                </h3>
                <p className="text-sm text-gray-600">
                  Please wait while we process your repayment...
                </p>
                <div className="mt-4 space-y-2 text-xs text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Processing repayment request...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Repay Success Modal */}
      {repayTxHash && (
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
                  ✅ Seamless Repayment Completed!
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Your loan has been repaid successfully.
                </p>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Transaction Hash:</p>
                  <p className="text-xs font-mono text-gray-800 break-all">
                    {repayTxHash}
                  </p>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => {
                      window.open(`https://explorer.test.mezo.org/tx/${repayTxHash}`, '_blank');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
                    size="sm"
                  >
                    🔍 View on Explorer
                  </Button>
                  <Button
                    onClick={() => setRepayTxHash('')}
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