'use client';

import React, { useState, useEffect } from 'react';
import { useWallets, usePrivy } from '@privy-io/react-auth';
import { useStaking } from '@/hooks/useStaking';
import { useRepay } from '@/hooks/useRepay';
import { useInvoiceNFT } from '@/hooks/useInvoiceNFT';
import { useBorrow } from '@/hooks/useBorrow';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  DollarSign, 
  TrendingUp, 
  CreditCard, 
  FileText, 
  Shield, 
  CheckCircle, 
  AlertTriangle,
  Activity,
  Zap
} from 'lucide-react';
import Link from 'next/link';
import { useKyc } from '@/hooks/useKyc';

export default function SupplierDashboard() {
  const { wallets } = useWallets();
  const { status: kycStatus } = useKyc();
  const { user } = usePrivy();
  const privyWallet = wallets.find(w => w.walletClientType === 'privy' || (w.meta && w.meta.id === 'io.privy.wallet'));
  const address = privyWallet?.address;

  // Hooks for data
  const { stakedAmount, currentTier, metrikBalance } = useStaking(address as `0x${string}`);
  const { outstandingLoans, repaymentStats } = useRepay(address as `0x${string}`);
  const { userInvoices, fetchUserInvoices } = useInvoiceNFT(address as `0x${string}`);
  const { userLoans, activeLoans, borrowStats } = useBorrow(address as `0x${string}`);
  
  // Token balances
  const { getFormattedBalance } = useTokenBalance();

  const [isLoading, setIsLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (address) {
        try {
          await Promise.all([
            fetchUserInvoices(address as `0x${string}`), // Use the regular function that works with deployed contract
            // The useStaking hook automatically fetches data on mount
          ]);
          // Simulate loading time for better UX
          setTimeout(() => setIsLoading(false), 1000);
        } catch (error) {
          console.error('Error loading dashboard data:', error);
          setIsLoading(false);
        }
      }
    };

    loadDashboardData();
  }, [address, fetchUserInvoices]);

  // Calculate dashboard stats
  const totalInvoices = userInvoices?.length || 0;
  const activeInvoices = userInvoices?.filter(inv => !inv.isBurned).length || 0;
  const burnedInvoices = userInvoices?.filter(inv => inv.isBurned).length || 0;
  const verifiedInvoices = userInvoices?.filter(inv => inv.isVerified).length || 0;

  const totalBorrowed = activeLoans?.reduce((sum, loan) => sum + Number(loan.amount), 0) || 0;
  const totalRepaid = borrowStats?.totalRepaid || 0;
  const stakingTier = currentTier || 0;
  const stakingTierName = ['None', 'Diamond', 'Gold', 'Silver', 'Bronze'][stakingTier] || 'Unknown';

  // Fetch real recent activity from blockchain events
  useEffect(() => {
    const fetchRecentActivity = async () => {
      if (!address) return;
      
      try {
        const activity = [];
        
        // Fetch recent staking events
        if (stakedAmount && parseFloat(stakedAmount) > 0) {
          activity.push({
            id: 'stake-1',
            type: 'stake',
            description: `Staked ${stakedAmount} METRIK tokens`,
            amount: `${stakedAmount} METRIK`,
            date: new Date(Date.now() - 24 * 60 * 60 * 1000), // Approximate
            status: 'completed'
          });
        }
        
        // Fetch recent invoice events
        if (userInvoices && userInvoices.length > 0) {
          userInvoices.forEach((invoice) => {
            activity.push({
              id: `invoice-${invoice.id}`,
              type: 'invoice',
              description: `Created Invoice #${invoice.invoiceId}`,
              amount: `$${(Number(invoice.creditAmount) / 1e6).toFixed(2)}`,
              date: invoice.dueDate,
              status: invoice.isVerified ? 'verified' : 'pending'
            });
          });
        }
        
        // Fetch recent borrowing events
        if (userLoans && userLoans.length > 0) {
          userLoans.forEach((loan) => {
            activity.push({
              id: `borrow-${loan.invoiceId}`,
              type: 'borrow',
              description: `Borrowed $${loan.amount} against Invoice #${loan.invoiceId}`,
              amount: `$${loan.amount}`,
              date: loan.dueDate,
              status: loan.status
            });
          });
        }
        
        // Sort by date (most recent first)
        activity.sort((a, b) => b.date.getTime() - a.date.getTime());
        
        // Take only the most recent 5 activities
        setRecentActivity(activity.slice(0, 5));
        
      } catch (error) {
        console.error('Error fetching recent activity:', error);
        setRecentActivity([]);
      }
    };
    
    fetchRecentActivity();
  }, [address, stakedAmount, userInvoices, userLoans]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'borrow': return <CreditCard className="w-4 h-4" />;
      case 'invoice': return <FileText className="w-4 h-4" />;
      case 'stake': return <Shield className="w-4 h-4" />;
      case 'repay': return <CheckCircle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'borrow': return 'text-blue-600 bg-blue-100';
      case 'invoice': return 'text-green-600 bg-green-100';
      case 'stake': return 'text-purple-600 bg-purple-100';
      case 'repay': return 'text-emerald-600 bg-emerald-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-[#ffffff] to-[#ffffff] via-[#ffffff] shadow-lg rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              <span className="text-[#E84142]">Welcome back, {user?.email?.address || 'Supplier'}</span>
            </h1>
            <p className="text-[#fa4a4a]">Manage your invoices, borrowing, and staking all in one place</p>
          </div>
          <div className="text-right">
            <Badge variant="secondary" className="bg-white/20 text-gray-600">
              {stakingTierName} Tier
            </Badge>
            <p className="text-sm text-gray-600 mt-1">Address: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
          </div>
        </div>
      </div>

      {/* KYC status card with step guidance */}
      {kycStatus !== 'verified' ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-amber-900 font-semibold">Getting started</div>
              <div className="text-amber-800 text-sm mt-1">
                {kycStatus === 'not_submitted' && 'Step 1: Submit your KYC to unlock staking, invoicing, borrow and repay.'}
                {kycStatus === 'pending_review' && 'Your KYC is under review. You can browse the dashboard while we verify.'}
                {kycStatus === 'rejected' && 'Your KYC was rejected. Please resubmit your documents.'}
              </div>
              <ol className="mt-3 ml-4 list-decimal text-sm text-amber-900 space-y-1">
                <li>Open the KYC modal and upload business documents</li>
                <li>We review and approve (usually a few minutes)</li>
                <li>Once verified, proceed to Stake → Invoice → Borrow → Repay</li>
              </ol>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-amber-700">Status</div>
              <div className="text-sm capitalize">{kycStatus.replace('_',' ')}</div>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-kyc-modal'))}
                className="mt-2 inline-flex items-center px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs hover:bg-indigo-700"
              >
                Open KYC modal
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-800">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
          </span>
          <span className="font-medium">Verified</span>
          <span className="text-sm">You can now Stake → create Invoices → Borrow → Repay. Tooltips will guide you.</span>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/dashboard/supplier/staking">
          <Card className="hover:shadow-xl transition-all cursor-pointer border-0 bg-gradient-to-br from-purple-50 to-white hover:from-purple-100 hover:scale-[1.01]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-purple-600" />
                Staking
              </CardTitle>
              <CardDescription>Manage your METRIK tokens</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {stakedAmount} METRIK
              </div>
              <p className="text-sm text-muted-foreground">Staked amount</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/supplier/invoice">
          <Card className="hover:shadow-xl transition-all cursor-pointer border-0 bg-gradient-to-br from-emerald-50 to-white hover:from-emerald-100 hover:scale-[1.01]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-green-600" />
                Create Invoice
              </CardTitle>
              <CardDescription>Mint new invoice NFTs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {activeInvoices}
              </div>
              <p className="text-sm text-muted-foreground">Active invoices</p>
              {burnedInvoices > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {burnedInvoices} completed • {totalInvoices} total
                </p>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/supplier/borrow">
          <Card className="hover:shadow-xl transition-all cursor-pointer border-0 bg-gradient-to-br from-sky-50 to-white hover:from-sky-100 hover:scale-[1.01]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5 text-blue-600" />
                Borrow
              </CardTitle>
              <CardDescription>Borrow against invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                ${totalBorrowed.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <p className="text-sm text-muted-foreground">Total borrowed</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/supplier/repay">
          <Card className="hover:shadow-xl transition-all cursor-pointer border-0 bg-gradient-to-br from-rose-50 to-white hover:from-rose-100 hover:scale-[1.01]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                Repay
              </CardTitle>
              <CardDescription>Repay outstanding loans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {outstandingLoans.length}
              </div>
              <p className="text-sm text-muted-foreground">Active loans</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="group hover:shadow-2xl transition-all duration-500 hover:scale-105 border-0 bg-gradient-to-br from-white to-gray-50/50 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#E84142]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide">METRIK Balance</CardTitle>
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-[#E84142] to-rose-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold bg-gradient-to-r from-[#E84142] to-rose-500 bg-clip-text text-transparent mb-2">
              {getFormattedBalance('metrik')} METRIK
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <p className="text-xs text-gray-500">Available for staking</p>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-2xl transition-all duration-500 hover:scale-105 border-0 bg-gradient-to-br from-white to-green-50/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide">MUSD Balance</CardTitle>
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full border-2 border-white animate-pulse"></div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent mb-2">
              {getFormattedBalance('usdc')} MUSD
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <p className="text-xs text-gray-500">Available for repayment</p>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-2xl transition-all duration-500 hover:scale-105 border-0 bg-gradient-to-br from-white to-orange-50/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Outstanding Balance</CardTitle>
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full border-2 border-white animate-pulse"></div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-500 bg-clip-text text-transparent mb-2">
              ${(Number(repaymentStats.totalOutstanding) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
              <p className="text-xs text-gray-500">Amount to be repaid</p>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-2xl transition-all duration-500 hover:scale-105 border-0 bg-gradient-to-br from-white to-blue-50/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Verified Invoices</CardTitle>
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full border-2 border-white animate-pulse"></div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex items-baseline space-x-2 mb-2">
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                {verifiedInvoices}
              </div>
              <div className="text-sm text-gray-400">/ {totalInvoices}</div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <p className="text-xs text-gray-500">Total invoices</p>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-2xl transition-all duration-500 hover:scale-105 border-0 bg-gradient-to-br from-white to-purple-50/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Borrow Interest Rate</CardTitle>
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-400 rounded-full border-2 border-white animate-pulse"></div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent mb-2">
              8%
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
              <p className="text-xs text-gray-500">Annual interest rate</p>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-2xl transition-all duration-500 hover:scale-105 border-0 bg-gradient-to-br from-white to-teal-50/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Total Repaid</CardTitle>
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-teal-400 rounded-full border-2 border-white animate-pulse"></div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent mb-2">
              ${totalRepaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></div>
              <p className="text-xs text-gray-500">Historical repayments</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="loans">Loan History</TabsTrigger>
          <TabsTrigger value="invoices">Invoice Status</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Visual Overview Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Portfolio Breakdown (Donut) */}
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Breakdown</CardTitle>
                <CardDescription>Distribution of assets and positions</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const metrik = Number((getFormattedBalance('metrik') || '0').toString().split(' ')[0]) || 0;
                  const usdc = Number((getFormattedBalance('usdc') || '0').toString().split(' ')[0]) || 0;
                  const staked = parseFloat(stakedAmount || '0') || 0;
                  const total = Math.max(metrik + usdc + staked, 1);
                  const pct = (val: number) => (val / total) * 100;
                  // Donut segments
                  const segments = [
                    { color: '#E84142', value: pct(staked), label: 'Staked' },
                    { color: '#22c55e', value: pct(usdc), label: 'MUSD' },
                    { color: '#6366f1', value: pct(metrik), label: 'METRIK' },
                  ];
                  // Build stroke-dasharray string
                  let offset = 25; // start at 12 o'clock
                  const radius = 60;
                  const circumference = 2 * Math.PI * radius;
                  const arcs = segments.map((s, i) => {
                    const len = (s.value / 100) * circumference;
                    const dash = `${len} ${circumference - len}`;
                    const style = { strokeDasharray: dash, strokeDashoffset: offset, stroke: s.color } as React.CSSProperties;
                    offset -= (s.value / 100) * circumference;
                    return <circle key={i} r={radius} cx="80" cy="80" fill="transparent" strokeWidth="16" style={style} className="transition-all duration-500" />
                  });
                  return (
                    <div className="flex items-center gap-6">
                      <svg viewBox="0 0 160 160" className="w-40 h-40">
                        <circle r={radius} cx="80" cy="80" fill="transparent" stroke="#f1f5f9" strokeWidth="16" />
                        {arcs}
                        <circle r={40} cx="80" cy="80" fill="#ffffff" />
                        <text x="80" y="80" textAnchor="middle" dominantBaseline="middle" className="fill-gray-900 text-sm font-semibold">
                          {(total).toLocaleString()}
                        </text>
                      </svg>
                      <div className="grid grid-cols-3 gap-4 flex-1">
                        {segments.map((s) => (
                          <div key={s.label} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                              <span className="text-sm font-medium">{s.label}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">{s.value.toFixed(1)}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Borrow vs Repay Trend</CardTitle>
                <CardDescription>Recent simulated on-chain activity</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  // Create a simple trend from available numbers (mock if missing)
                  const baseBorrow = Number(totalBorrowed) || 0;
                  const baseRepaid = Number(totalRepaid) || 0;
                  const points = new Array(12).fill(0).map((_, i) => ({
                    b: baseBorrow * (0.3 + (i + 1) / 20),
                    r: baseRepaid * (0.2 + (12 - i) / 30)
                  }));
                  const maxY = Math.max(1, ...points.map(p => Math.max(p.b, p.r)));
                  const scaleX = (i: number) => (i / 11) * 300 + 10;
                  const scaleY = (v: number) => 120 - (v / maxY) * 110;
                  const path = (key: 'b'|'r') => points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(p[key])}`).join(' ');
                  return (
                    <div className="w-full">
                      <svg viewBox="0 0 320 140" className="w-full h-36">
                        <defs>
                          <linearGradient id="gradBorrow" x1="0" x2="1" y1="0" y2="0">
                            <stop offset="0%" stopColor="#E84142" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#E84142" stopOpacity="0" />
                          </linearGradient>
                          <linearGradient id="gradRepay" x1="0" x2="1" y1="0" y2="0">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d={path('b')} fill="none" stroke="#E84142" strokeWidth="2" />
                        <path d={`${path('b')} L 310 140 L 10 140 Z`} fill="url(#gradBorrow)" />
                        <path d={path('r')} fill="none" stroke="#22c55e" strokeWidth="2" />
                        <path d={`${path('r')} L 310 140 L 10 140 Z`} fill="url(#gradRepay)" />
                      </svg>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{background:'#E84142'}} /> Borrow</div>
                        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Repay</div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Repayment Progress</CardTitle>
                <CardDescription>Your overall repayment status</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const percent = totalBorrowed + totalRepaid > 0 ? (totalRepaid / (totalBorrowed + totalRepaid)) * 100 : 0;
                  const radius = 70;
                  const circumference = 2 * Math.PI * radius;
                  const dash = (percent / 100) * circumference;
                  return (
                    <div className="flex items-center gap-6">
                      <svg viewBox="0 0 180 180" className="w-44 h-44">
                        <circle cx="90" cy="90" r={radius} fill="none" stroke="#eef2f7" strokeWidth="16" />
                        <circle
                          cx="90"
                          cy="90"
                          r={radius}
                          fill="none"
                          stroke="#E84142"
                          strokeWidth="16"
                          strokeLinecap="round"
                          strokeDasharray={`${dash} ${circumference - dash}`}
                          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dasharray 600ms ease' }}
                        />
                        <text x="90" y="80" textAnchor="middle" className="fill-gray-900 text-xl font-semibold">{percent.toFixed(0)}%</text>
                        <text x="90" y="104" textAnchor="middle" className="fill-gray-500 text-xs">repaid</text>
                      </svg>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Repaid</div>
                        <div className="text-2xl font-semibold">${totalRepaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div className="text-sm text-muted-foreground">Total</div>
                        <div className="text-lg">${(totalBorrowed + totalRepaid).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      </div>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Staking Tier System</CardTitle>
                <CardDescription>METRIK staking tiers and points system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tier</TableHead>
                        <TableHead>Min Stake</TableHead>
                        <TableHead className="hidden sm:table-cell">Benefits</TableHead>
                        <TableHead className="w-[120px] text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { name: 'Bronze', min: '1,000 METRIK', color: 'bg-amber-100 text-amber-800', key: 4 },
                        { name: 'Silver', min: '2,500 METRIK', color: 'bg-zinc-100 text-zinc-700', key: 3 },
                        { name: 'Gold', min: '5,000 METRIK', color: 'bg-yellow-100 text-yellow-800', key: 2 },
                        { name: 'Diamond', min: '10,000 METRIK', color: 'bg-indigo-100 text-indigo-800', key: 1 },
                      ].map((row) => (
                        <TableRow key={row.key} className={stakingTier === row.key ? 'bg-rose-50/60' : ''}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>{row.min}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="text-xs">Lower fees</Badge>
                              <Badge variant="outline" className="text-xs">Higher points</Badge>
                              <Badge variant="outline" className="text-xs">Priority verify</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {stakingTier === row.key ? (
                              <Badge className="bg-[#E84142] text-white">Current</Badge>
                            ) : (
                              <Badge variant="secondary" className={row.color}>Locked</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Points System:</strong> Earn 1 point per METRIK staked. 
                    <br />
                    <strong>Duration Bonus:</strong> Staking for 180+ days gives 2x points multiplier.
                    <br />
                    <strong>Your Current Tier:</strong> {stakingTierName}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>APY Rates by Duration</CardTitle>
                <CardDescription>Annual Percentage Yield based on staking duration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Duration</TableHead>
                        <TableHead>APY Rate</TableHead>
                        <TableHead className="hidden md:table-cell">Visualization</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { d: '45 days', apy: 1 },
                        { d: '90 days', apy: 3 },
                        { d: '180 days', apy: 5 },
                        { d: '365 days', apy: 8 },
                      ].map((row) => (
                        <TableRow key={row.d}>
                          <TableCell className="font-medium">{row.d}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-[#E84142]/30 text-[#E84142]">{row.apy}% APY</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="relative h-2 w-full rounded-full bg-muted">
                              <div className="absolute left-0 top-0 h-2 rounded-full bg-[#E84142]" style={{ width: `${row.apy * 10}%` }} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Duration Multipliers</CardTitle>
                <CardDescription>Points calculation based on staking duration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Duration</TableHead>
                        <TableHead>Multiplier</TableHead>
                        <TableHead className="hidden md:table-cell">Points Formula</TableHead>
                        <TableHead>Example</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { d: '45 days', m: '1.0x', f: 'amount × 10 ÷ 10', e: '1000 METRIK = 1000 points' },
                        { d: '90 days', m: '1.3x', f: 'amount × 13 ÷ 10', e: '1000 METRIK = 1300 points' },
                        { d: '180 days', m: '1.5x', f: 'amount × 15 ÷ 10', e: '1000 METRIK = 1500 points' },
                        { d: '365 days', m: '2.0x', f: 'amount × 20 ÷ 10', e: '1000 METRIK = 2000 points' },
                      ].map((row) => (
                        <TableRow key={row.d}>
                          <TableCell className="font-medium">{row.d}</TableCell>
                          <TableCell>
                            <Badge className="bg-emerald-100 text-emerald-800" variant="secondary">{row.m}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">{row.f}</TableCell>
                          <TableCell>{row.e}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest transactions and actions</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading recent activity...</p>
                  </div>
                </div>
              ) : recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-4 p-3 rounded-lg border">
                      <div className={`p-2 rounded-full ${getActivityColor(activity.type)}`}>
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{activity.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {activity.date.toLocaleDateString()} • {activity.amount}
                        </p>
                      </div>
                      <Badge variant={activity.status === 'completed' || activity.status === 'verified' ? 'default' : activity.status === 'pending' ? 'secondary' : 'destructive'}>
                        {activity.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    <Activity className="h-12 w-12 mx-auto" />
                  </div>
                  <p className="text-gray-600 font-medium">No recent activity</p>
                  <p className="text-sm text-gray-500 mt-1">Your transactions will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Loan History</CardTitle>
              <CardDescription>All your borrowing and repayment history</CardDescription>
            </CardHeader>
            <CardContent>
              {userLoans && userLoans.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Interest</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userLoans.map((loan) => (
                      <TableRow key={loan.invoiceId}>
                        <TableCell className="font-mono">#{loan.invoiceId}</TableCell>
                        <TableCell>${loan.amount}</TableCell>
                        <TableCell>${loan.interestAccrued}</TableCell>
                        <TableCell>{loan.dueDate.toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={loan.status === 'active' ? 'default' : loan.status === 'repaid' ? 'secondary' : 'destructive'}>
                            {loan.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {loan.status === 'active' ? (
                            <Link href="/dashboard/supplier/repay">
                              <Button size="sm" variant="outline">
                                Repay
                              </Button>
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {loan.status === 'repaid' ? 'Completed' : 'Liquidated'}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="mb-2">No loan history found</p>
                  <p className="text-sm">Your borrowing and repayment history will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Status</CardTitle>
              <CardDescription>All your created invoices and their verification status</CardDescription>
            </CardHeader>
            <CardContent>
              {userInvoices && userInvoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userInvoices.map((invoice) => (
                      <TableRow key={invoice.invoiceId}>
                        <TableCell className="font-mono">#{invoice.invoiceId}</TableCell>
                        <TableCell>${(Number(invoice.creditAmount) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Badge variant={invoice.isVerified ? 'default' : 'secondary'}>
                              {invoice.isVerified ? 'Verified' : 'Pending'}
                            </Badge>
                            {invoice.isBurned && (
                              <Badge variant="destructive">
                                {invoice.burnReason === 'repayment' ? 'Repaid' : 'Burned'}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{invoice.dueDate.toLocaleDateString()}</TableCell>
                        <TableCell>
                          {invoice.isBurned ? (
                            <span className="text-sm text-muted-foreground">
                              {invoice.burnReason === 'repayment' ? 'Loan completed' : 'Invoice burned'}
                              {invoice.burnTime && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {invoice.burnTime.toLocaleDateString()}
                                </div>
                              )}
                            </span>
                          ) : invoice.isVerified ? (
                            <Link href="/dashboard/supplier/borrow">
                              <Button size="sm" variant="outline">
                                Borrow
                              </Button>
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground">Waiting for verification</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No invoices found. <Link href="/dashboard/supplier/invoice" className="text-blue-600 hover:underline">Create your first invoice</Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 