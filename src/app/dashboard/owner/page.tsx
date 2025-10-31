'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useInvoiceNFT } from '@/hooks/useInvoiceNFT';
import { useStaking } from '@/hooks/useStaking';
import { OwnerPlatformFees } from '@/components/dashboard/OwnerPlatformFees';
import { VerifierStakingInterface } from '@/components/contracts/VerifierStakingInterface';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, CheckCircle, FileText, Shield, Coins, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { keccak256, toUtf8Bytes } from 'ethers';
import { Copy } from 'lucide-react';

const CONTRACT_OWNER = process.env.NEXT_PUBLIC_CONTRACT_OWNER?.toLowerCase();

export default function OwnerDashboard() {
  const { address } = useAccount();
  const {
    invoices,
    fetchInvoices,
    verifyInvoice,
    hasVerifierRole,
    isLoading,
    error
  } = useInvoiceNFT();

  const { stakedAmount, currentTier } = useStaking(address);

  const [isVerifier, setIsVerifier] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [granting, setGranting] = useState(false);
  const [hasStakedTokens, setHasStakedTokens] = useState(false);
  const [kycPending, setKycPending] = useState<Array<{ id: string; email?: string; walletAddress?: string; documentPaths: string[]; updatedAt: number }>>([]);
  const [zkKycPending, setZkKycPending] = useState<Array<{ id: string; walletAddress: string; companyDataHash: string; documentHashes: string[]; kycStatus: string; createdAt: number }>>([]);
  const [loadingKyc, setLoadingKyc] = useState(false);

  useEffect(() => {
    if (address) {
      // Fetch invoices for verification
      fetchInvoices(address);
      hasVerifierRole(address).then((hasRole) => {
        setIsVerifier(hasRole);
        setIsCheckingRole(false);
      });
    } else {
      setIsCheckingRole(false);
    }
  }, [address, fetchInvoices, hasVerifierRole]);

  // Check if user has staked tokens
  useEffect(() => {
    if (stakedAmount && parseFloat(stakedAmount) > 0) {
      setHasStakedTokens(true);
    } else {
      setHasStakedTokens(false);
    }
  }, [stakedAmount]);

  const handleGrantRole = async () => {
    if (!hasStakedTokens) {
      toast.error('You must stake METRIK tokens before becoming a verifier');
      return;
    }

    setGranting(true);
    try {
      const VERIFIER_ROLE = keccak256(toUtf8Bytes("VERIFIER_ROLE"));
      const res = await fetch('/api/grant-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: VERIFIER_ROLE, address }),
      });
      const data = await res.json();
      if (data.success) {
        // Wait for role to propagate
        if (!address) throw new Error('No address found');
        let hasRole = false;
        for (let i = 0; i < 10; i++) {
          hasRole = await hasVerifierRole(address);
          if (hasRole) break;
          await new Promise(r => setTimeout(r, 1000));
        }
        setIsVerifier(true);
        toast.success('Verifier role granted!');
      } else {
        toast.error('Error: ' + data.error);
      }
    } finally {
      setGranting(false);
    }
  };

  const handleVerifyInvoice = async (tokenId: string) => {
    try {
      if (!isVerifier) {
        throw new Error('Only verifiers can verify invoices');
      }
      await verifyInvoice(tokenId);
      // No need to manually refresh, hook will do it
    } catch (err: unknown) {
      // Show concise error using toast
      const msg = (err as Error)?.message || 'Error verifying invoice.';
      toast.error(msg);
    }
  };

  // Sort invoices: pending first, then verified
  const sortedInvoices = [...invoices].sort((a, b) => {
    if (a.isVerified === b.isVerified) {
      return new Date(Number(b.dueDate) * 1000).getTime() - new Date(Number(a.dueDate) * 1000).getTime(); // Newest first
    }
    return a.isVerified ? 1 : -1; // Pending first
  });

  const pendingInvoices = sortedInvoices.filter(invoice => !invoice.isVerified);
  const verifiedInvoices = sortedInvoices.filter(invoice => invoice.isVerified);

  // Show staking interface if user hasn't staked tokens
  if (!hasStakedTokens) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-600" />
              Verifier Requirements
            </CardTitle>
            <CardDescription>
              To become a verifier, you must first stake METRIK tokens. This ensures verifiers have skin in the game and are incentivized to act honestly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <Coins className="h-4 w-4" />
                <AlertDescription>
                  <strong>Staking Requirement:</strong> You need to stake METRIK tokens before you can become a verifier.
                  This helps maintain the integrity of the verification process.
                </AlertDescription>
              </Alert>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Current Status:</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Staked Amount:</span>
                    <span className="font-mono">{stakedAmount || '0'} METRIK</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Tier:</span>
                    <Badge variant={currentTier >= 3 ? "default" : "secondary"}>
                      {currentTier === 0 ? 'None' :
                        currentTier === 1 ? 'Bronze' :
                          currentTier === 2 ? 'Silver' :
                            currentTier === 3 ? 'Gold' : 'Diamond'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stake METRIK Tokens</CardTitle>
            <CardDescription>
              Use the interface below to stake your METRIK tokens. Once you have staked tokens, you can apply to become a verifier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VerifierStakingInterface />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show role granting interface if user has staked but isn't a verifier yet
  if (!isVerifier) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              Ready to Become a Verifier
            </CardTitle>
            <CardDescription>
              Great! You have staked METRIK tokens. You can now apply to become a verifier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Staking Requirement Met:</strong> You have successfully staked {stakedAmount} METRIK tokens.
                </AlertDescription>
              </Alert>

              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">Current Status:</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Staked Amount:</span>
                    <span className="font-mono text-green-700">{stakedAmount} METRIK</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Tier:</span>
                    <Badge variant="default" className="bg-green-600">
                      {currentTier === 1 ? 'Bronze' :
                        currentTier === 2 ? 'Silver' :
                          currentTier === 3 ? 'Gold' : 'Diamond'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleGrantRole}
                  disabled={granting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                  {granting ? 'Granting Verifier Role...' : 'Become a Verifier'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show the main verifier dashboard
  return (
    <div className="space-y-6">
      {/* KYC Review */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            KYC Review
          </CardTitle>
          <CardDescription>Review supplier submissions and approve or reject.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">
              Pending submissions: {kycPending.length} regular + {zkKycPending.length} ZK privacy
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  setLoadingKyc(true);
                  // Fetch regular KYC data
                  const res = await fetch('/api/kyc/admin', { cache: 'no-store' });
                  const data = await res.json();
                  setKycPending(data.pending || []);

                  // Fetch ZK KYC data
                  const zkRes = await fetch('/api/kyc/zk-pending', { cache: 'no-store' });
                  const zkData = await zkRes.json();
                  setZkKycPending(zkData.records || []);
                } finally {
                  setLoadingKyc(false);
                }
              }}
            >
              {loadingKyc ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          {kycPending.length === 0 && zkKycPending.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mb-4">
                <Shield className="h-10 w-10 text-purple-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No KYC Submissions</h3>
              <p className="text-gray-600 mb-4">
                No KYC submissions are currently pending review. New submissions will appear here.
              </p>
              <p className="text-sm text-gray-500">
                💡 Please click the "Refresh" button above if no KYC submissions appear - sometimes it takes time to load.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Regular KYC Section */}
              {kycPending.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 text-blue-800">Regular KYC Submissions</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business</TableHead>
                        <TableHead>Documents</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kycPending.map((r) => {
                        const rec: any = {
                          companyName: (r as any).companyName ?? (r as any).companyname,
                          email: (r as any).email,
                          imageUrls: (r as any).imageUrls ?? (r as any).imageurls ?? [],
                          documentUrls: (r as any).documentUrls ?? (r as any).documenturls ?? [],
                          updatedAt: (r as any).updatedAt ?? (r as any).updatedat,
                        };
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="text-sm">
                              <div className="font-semibold">{rec.companyName || '—'}</div>
                              <div className="font-mono text-xs text-gray-600 flex items-center gap-2">
                                <span>{r.id.length > 20 ? `${r.id.slice(0, 8)}...${r.id.slice(-4)}` : r.id}</span>
                                <button
                                  onClick={() => navigator.clipboard.writeText(r.id)}
                                  className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
                                  title="Copy"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex flex-wrap gap-2">
                                {(rec.imageUrls || []).slice(0, 4).map((url: string, idx: number) => (
                                  <a key={idx} href={url} target="_blank" className="block w-12 h-12 rounded overflow-hidden border">
                                    <img src={url} alt="doc" className="w-full h-full object-cover" />
                                  </a>
                                ))}
                                {(rec.documentUrls || []).slice(0, 2).map((url: string, idx: number) => (
                                  <a key={`doc-${idx}`} href={url} target="_blank" className="text-xs underline text-indigo-600">PDF {idx + 1}</a>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{rec.updatedAt ? new Date(rec.updatedAt).toLocaleString() : '-'}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={async () => {
                                    const res = await fetch('/api/kyc/admin', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ action: 'approve', id: r.id }),
                                    });
                                    const data = await res.json();
                                    if (!res.ok) return toast.error(data?.error || 'Approve failed');
                                    toast.success('KYC approved');
                                    setKycPending(prev => prev.filter(x => x.id !== r.id));
                                  }}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={async () => {
                                    const reason = window.prompt('Reason for rejection?') || 'Not specified';
                                    const res = await fetch('/api/kyc/admin', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ action: 'reject', id: r.id, reason }),
                                    });
                                    const data = await res.json();
                                    if (!res.ok) return toast.error(data?.error || 'Reject failed');
                                    toast.success('KYC rejected');
                                    setKycPending(prev => prev.filter(x => x.id !== r.id));
                                  }}
                                >
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* ZK KYC Section */}
              {zkKycPending.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 text-green-800">ZK Privacy KYC Submissions</h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-green-800">
                      <strong>Privacy Protected:</strong> These submissions use cryptographic hashing.
                      Only verification status and hashes are stored, not plaintext sensitive data.
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Wallet Address</TableHead>
                        <TableHead>Company Hash</TableHead>
                        <TableHead>Documents</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {zkKycPending.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-mono text-sm">
                            {record.walletAddress.slice(0, 8)}...{record.walletAddress.slice(-4)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {record.companyDataHash.slice(0, 16)}...
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{record.documentHashes.length} files</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-yellow-100">
                              {record.kycStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={async () => {
                                  const res = await fetch('/api/kyc/zk-update', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      id: record.id,
                                      kycStatus: 'verified'
                                    }),
                                  });
                                  if (res.ok) {
                                    toast.success('ZK KYC approved');
                                    setZkKycPending(prev => prev.filter(x => x.id !== record.id));
                                  } else {
                                    const errorData = await res.json();
                                    toast.error(`Approval failed: ${errorData.error || 'Unknown error'}`);
                                  }
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  const res = await fetch('/api/kyc/zk-update', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      id: record.id,
                                      kycStatus: 'rejected'
                                    }),
                                  });
                                  if (res.ok) {
                                    toast.success('ZK KYC rejected');
                                    setZkKycPending(prev => prev.filter(x => x.id !== record.id));
                                  } else {
                                    const errorData = await res.json();
                                    toast.error(`Rejection failed: ${errorData.error || 'Unknown error'}`);
                                  }
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Platform Fee Management */}
      <OwnerPlatformFees />

      {/* Invoice Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Verification
          </CardTitle>
          <CardDescription>
            Review and verify pending invoices. Only verified invoices can be used as collateral for borrowing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading invoices...</p>
            </div>
          ) : !address ? (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                <Shield className="h-12 w-12 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Wallet to View Invoices</h3>
              <p className="text-gray-600 mb-4">
                Please connect your wallet to view and verify invoices.
              </p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <FileText className="h-10 w-10 text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Invoices Available</h3>
              <p className="text-gray-600">
                No invoices have been submitted yet. When suppliers create invoices, they will appear here for verification.
              </p>
            </div>
          ) : (
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pending ({pendingInvoices.length})
                </TabsTrigger>
                <TabsTrigger value="verified" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Verified ({verifiedInvoices.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-4">
                {pendingInvoices.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                      <Clock className="h-10 w-10 text-blue-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Invoices</h3>
                    <p className="text-gray-600">
                      No invoices are available to fetch since none have been submitted yet. Check back later for new submissions.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice ID</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-mono text-sm">
                            {invoice.invoiceId}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {invoice.supplier.slice(0, 8)}...{invoice.supplier.slice(-4)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {invoice.buyer.slice(0, 8)}...{invoice.buyer.slice(-4)}
                          </TableCell>
                          <TableCell>${Number(invoice.creditAmount) / 1e6}</TableCell>
                          <TableCell>
                            {new Date(Number(invoice.dueDate) * 1000).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">Pending</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              onClick={() => handleVerifyInvoice(invoice.id)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Verify
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="verified" className="space-y-4">
                {verifiedInvoices.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle className="h-10 w-10 text-green-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Verified Invoices</h3>
                    <p className="text-gray-600">
                      Start verifying invoices to see them appear here. Verified invoices can be used as collateral.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice ID</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {verifiedInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-mono text-sm">
                            {invoice.invoiceId}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {invoice.supplier.slice(0, 8)}...{invoice.supplier.slice(-4)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {invoice.buyer.slice(0, 8)}...{invoice.buyer.slice(-4)}
                          </TableCell>
                          <TableCell>${Number(invoice.creditAmount) / 1e6}</TableCell>
                          <TableCell>
                            {new Date(Number(invoice.dueDate) * 1000).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" className="bg-green-600">
                              Verified
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Withdraw button example (show only for contract owner) */}
      {address?.toLowerCase() === CONTRACT_OWNER && (
        <div className="mb-4">
          <Button className="bg-green-700 hover:bg-green-800">Withdraw</Button>
        </div>
      )}
    </div>
  );
} 