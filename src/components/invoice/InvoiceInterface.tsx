import React, { useState } from 'react';
import { useInvoiceNFT } from '@/hooks/useInvoiceNFT';
import { useOneClickInvoice } from '@/hooks/useOneClickInvoice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, FileText, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { generateEIP681URI } from '@/utils/eip681';
import { useWallets } from '@privy-io/react-auth';
import Link from 'next/link';

export function InvoiceInterface() {
  const { wallets } = useWallets();
  const privyWallet = wallets.find(w => w.walletClientType === 'privy' || (w.meta && w.meta.id === 'io.privy.wallet'));
  const address = privyWallet?.address;
  
  // One-click invoice creation hook
  const { executeOneClickInvoiceCreation, isExecuting } = useOneClickInvoice(wallets);
  const { 
    invoices, 
    isLoading, 
    error, 
    verifyInvoice,
    fetchInvoices,
    userInvoices,
    fetchUserInvoices
  } = useInvoiceNFT(address as `0x${string}`);

  // Debug userInvoices state
  React.useEffect(() => {
    console.log('🔍 InvoiceInterface userInvoices state:', userInvoices);
    console.log('🔍 InvoiceInterface userInvoices length:', userInvoices?.length || 0);
    if (userInvoices && userInvoices.length > 0) {
      console.log('🔍 InvoiceInterface userInvoices details:', userInvoices.map(inv => ({
        id: inv.id,
        invoiceId: inv.invoiceId,
        supplier: inv.supplier,
        isVerified: inv.isVerified
      })));
    }
  }, [userInvoices]);

  // Helper to generate a unique invoice ID
  function generateInvoiceId(addr?: string) {
    if (!addr) return '';
    const short = addr.slice(-6);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `INV-${short}-${rand}`;
  }

  // Initialize form with automated fields and fetch user invoices
  React.useEffect(() => {
    console.log('🔍 InvoiceInterface useEffect - address:', address);
    if (address) {
      setNewInvoice((prev) => ({
        ...prev,
        supplier: address,
        uniqueId: generateInvoiceId(address),
      }));
      
      // Fetch user invoices when component loads
      console.log('🔍 InvoiceInterface calling fetchUserInvoices with address:', address);
      fetchUserInvoices(address as `0x${string}`);
    } else {
      console.log('🔍 InvoiceInterface useEffect - no address available');
    }
  }, [address, fetchUserInvoices]);

  const [newInvoice, setNewInvoice] = useState({
    supplier: '',
    uniqueId: '',
    amount: '',
    dueDate: '',
    metadata: '',
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [invoiceTxHash, setInvoiceTxHash] = useState<string>('');

  // One-click invoice creation handler
  const handleOneClickCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newInvoice.supplier || !newInvoice.uniqueId || !newInvoice.amount || !newInvoice.dueDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      console.log('🚀 Initiating one-click invoice creation:', {
        supplier: newInvoice.supplier,
        uniqueId: newInvoice.uniqueId,
        amount: newInvoice.amount,
        dueDate: newInvoice.dueDate,
        metadata: newInvoice.metadata
      });
      
      const result = await executeOneClickInvoiceCreation(
        newInvoice.supplier,
        newInvoice.uniqueId,
        newInvoice.amount,
        newInvoice.dueDate,
        newInvoice.metadata || undefined
      );
      
      if (result?.success) {
        console.log('✅ One-click invoice creation successful!', result);
        
        // Reset form
        setNewInvoice({
          supplier: address || '',
          uniqueId: generateInvoiceId(address),
          amount: '',
          dueDate: '',
          metadata: '',
        });
        
        // Store transaction hash for success modal
        setInvoiceTxHash(result.mintHash || '');
      }
    } catch (error) {
      console.error('❌ One-click invoice creation error:', error);
      toast.error('One-click invoice creation failed. Please try again.');
    }
  };

  const handleVerifyInvoice = async (tokenId: string) => {
    try {
      setIsVerifying(true);
      await verifyInvoice(tokenId);
      toast.success('Invoice verified successfully!');
      // Refresh invoices
      if (address) {
        await fetchInvoices(address as `0x${string}`);
      }
    } catch (err) {
      console.error('Error verifying invoice:', err);
      toast.error('Failed to verify invoice');
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadge = (isVerified: boolean) => {
    return isVerified ? (
      <Badge variant="default" className="bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Verified
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
        <XCircle className="w-3 h-3 mr-1" />
        Pending
      </Badge>
    );
  };

  return (
    <div className="space-y-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="text-2xl font-bold">
                {invoices ? invoices.filter(inv => inv.supplier === address).length : 0}
              </div>
              {isLoading && (
                <div className="ml-2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Your invoices created
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="text-2xl font-bold">
                ${invoices ? invoices.filter(inv => inv.supplier === address).reduce((sum, inv) => sum + (Number(inv.creditAmount) / 1e6), 0).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0.00'}
              </div>
              {isLoading && (
                <div className="ml-2 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Your invoice value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified Invoices</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="text-2xl font-bold">
                {invoices ? invoices.filter(inv => inv.supplier === address && inv.isVerified).length : 0}
              </div>
              {isLoading && (
                <div className="ml-2 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Your verified invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="text-2xl font-bold">
                {invoices ? invoices.filter(inv => inv.supplier === address && !inv.isVerified).length : 0}
              </div>
              {isLoading && (
                <div className="ml-2 w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Your pending invoices
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="create" className="space-y-4">
        <TabsList>
          <TabsTrigger value="create">Create Invoice NFT</TabsTrigger>
          <TabsTrigger value="your-invoices">Your Invoices</TabsTrigger>
        </TabsList>

        {/* Create Invoice Tab */}
        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Create New Invoice NFT</span>
                <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full font-normal">
                  ⚡ Zero-Click Available
                </span>
              </CardTitle>
              <CardDescription>
                Seamlessly mint invoice NFTs with IPFS metadata integration (zero wallet prompts)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Seamless Invoice Benefits Info */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200 mb-4">
                <h4 className="text-sm font-semibold text-green-900 mb-2">⚡ Why Use Seamless Invoice Creation?</h4>
                <ul className="text-xs text-green-800 space-y-1">
                  <li>• <strong>Zero-Click:</strong> No wallet confirmations or prompts</li>
                  <li>• <strong>IPFS Integration:</strong> Automatic metadata upload and linking</li>
                  <li>• <strong>Instant NFT:</strong> Creates invoice NFT in complete background</li>
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
                        Creating invoice NFT in background... No action needed from you!
                      </p>
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-amber-700">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Step 1: Processing invoice data</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-amber-700">
                          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                          <span>Step 2: Minting Invoice NFT</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleOneClickCreateInvoice} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="supplier">Supplier Address</Label>
                    <Input
                      id="supplier"
                      type="text"
                      value={newInvoice.supplier}
                      readOnly
                      placeholder="0x..."
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="uniqueId">Unique Invoice ID</Label>
                    <Input
                      id="uniqueId"
                      type="text"
                      value={newInvoice.uniqueId}
                      readOnly
                      placeholder="Auto-generated"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Amount (MUSD)</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={newInvoice.amount}
                      onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                      placeholder="1000"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={newInvoice.dueDate}
                      onChange={(e) => setNewInvoice({ ...newInvoice, dueDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="invoiceFile">Invoice Document (PDF/JPG/PNG)</Label>
                  <Input
                    id="invoiceFile"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      setUploadError(null);
                      try {
                        const formData = new FormData();
                        formData.append('file', file);
                        const response = await fetch('/api/upload-to-ipfs', {
                          method: 'POST',
                          body: formData,
                        });
                        if (!response.ok) {
                          const error = await response.json();
                          throw new Error(error.error || 'Failed to upload to IPFS');
                        }
                        const data = await response.json();
                        setNewInvoice((prev) => ({ ...prev, metadata: data.ipfsHash }));
                      } catch (err: any) {
                        setUploadError(err.message || 'Failed to upload');
                        setNewInvoice((prev) => ({ ...prev, metadata: '' }));
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                  {uploading && <div className="text-xs text-blue-600 mt-1">Uploading...</div>}
                  {uploadError && <div className="text-xs text-red-600 mt-1">{uploadError}</div>}
                </div>
                <div>
                  <Label htmlFor="metadata">Metadata (IPFS Hash)</Label>
                  <Textarea
                    id="metadata"
                    value={newInvoice.metadata}
                    readOnly
                    placeholder="Auto-filled after upload"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This will be auto-filled after uploading your invoice document.
                  </p>
                </div>

                <Button 
                  type="submit" 
                  disabled={isExecuting}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ⚡ Creating Seamlessly...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      ⚡ SEAMLESS CREATE INVOICE (Zero-Click)
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>



        {/* Your Invoices Tab */}
        <TabsContent value="your-invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Invoices</CardTitle>
              <CardDescription>
                View and manage invoices you have created
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice ID</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices && invoices.filter(inv => inv.supplier === address).length > 0 ? (
                    invoices.filter(inv => inv.supplier === address).map((invoice) => {
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell>{invoice.invoiceId}</TableCell>
                          <TableCell>{invoice.supplier}</TableCell>
                          <TableCell>{(Number(invoice.creditAmount) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} MUSD</TableCell>
                          <TableCell>{invoice.dueDate ? new Date(Number(invoice.dueDate)).toLocaleDateString() : 'N/A'}</TableCell>
                          <TableCell>{getStatusBadge(invoice.isVerified)}</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                        No invoices found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Centered Invoice Loader */}
      {isExecuting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-xl max-w-md mx-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  ⚡ Seamless Invoice Creation
                </h3>
                <p className="text-sm text-gray-600">
                  Please wait while we create your invoice NFT...
                </p>
                <div className="mt-4 space-y-2 text-xs text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Processing invoice creation...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Success Modal */}
      {invoiceTxHash && (
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
                  ✅ Seamless Invoice Creation Completed!
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Your invoice NFT has been created successfully.
                </p>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Transaction Hash:</p>
                  <p className="text-xs font-mono text-gray-800 break-all">
                    {invoiceTxHash}
                  </p>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => {
                      window.open(`https://explorer.test.mezo.org/tx/${invoiceTxHash}`, '_blank');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
                    size="sm"
                  >
                    🔍 View on Explorer
                  </Button>
                  <Button
                    onClick={() => setInvoiceTxHash('')}
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