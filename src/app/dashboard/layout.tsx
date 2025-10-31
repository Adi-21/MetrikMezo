'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { toast } from 'react-toastify';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import Sidebar from '@/components/layout/Sidebar';
import { useKyc } from '@/hooks/useKyc';
import dynamic from 'next/dynamic';
const KycModal = dynamic(() => import('@/components/kyc/KycModal'), { ssr: false });

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { ready, authenticated, logout } = usePrivy();
  const pathname = usePathname();
  const { status: kycStatus } = useKyc();

  const { wallets } = useWallets();
  const privyWallet = wallets.find(w => w.walletClientType === 'privy' || (w.meta && w.meta.id === 'io.privy.wallet'));
  const address = privyWallet?.address;
  const [copied, setCopied] = useState(false);
  
  // Token balance for navbar
  const { getFormattedBalance } = useTokenBalance();

  // Derive role from pathname
  const role = pathname && pathname.includes('/dashboard/supplier') ? 'supplier' 
    : pathname && pathname.includes('/dashboard/lp') ? 'lp'
    : pathname && pathname.includes('/dashboard/owner') ? 'verifier'
    : null;

  useEffect(() => {
    console.log('Dashboard layout auth check:', {
      role,
      ready,
      authenticated,
      isConnected,
      pathname
    });
    
    if (role === 'supplier') {
      if (ready && !authenticated) {
        console.log('Supplier not authenticated, redirecting to home');
        router.push('/');
        return;
      }

      // Gate supplier routes by KYC status
      const base = '/dashboard/supplier';
      const isBase = pathname === base;
      const isChild = pathname && pathname.startsWith(base) && pathname !== base;
      if (isChild && kycStatus !== 'verified') {
        router.replace(base);
        const msg = kycStatus === 'not_submitted'
          ? 'Access restricted: submit KYC to continue. You can only view the dashboard until verification.'
          : 'Access restricted while KYC is pending review. You can only view the dashboard.';
        toast.info(msg);
        return;
      }
    } else {
    if (!isConnected) {
      console.log('Non-supplier not connected, redirecting to home');
      router.push('/');
      return;
      }
    }
    // If a role can't be determined from the pathname and the path is within /dashboard, redirect to home
    if (!role && pathname && pathname.startsWith('/dashboard')) {
      console.log('No role determined, redirecting to home');
      router.push('/');
      return;
    }
  }, [isConnected, role, router, pathname, ready, authenticated, kycStatus]);

  if ((role === 'supplier' && (!ready || !authenticated)) || (role !== 'supplier' && !isConnected) || !role) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    }
  };

  // Sidebar now renders the navigation items by role

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm sticky top-0 z-40 rounded-lg global-shadow mx-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/" className="text-xl font-bold text-gray-900">
                  Metrik Protocol
                </Link>
              </div>
              {/* Section tabs have moved to the sidebar */}
            </div>

            <div className="flex items-center gap-4">
              {role === 'supplier' && ready && authenticated && address && (
                <>
                  <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-md">
                    <span className="font-mono text-xs text-indigo-700">{address.slice(0, 8)}...{address.slice(-4)}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(address);
                        setCopied(true);
                        toast.success('Copied Privy Wallet Address!');
                        setTimeout(() => setCopied(false), 1500);
                      }}
                      className="text-xs px-2 py-1 bg-indigo-200 hover:bg-indigo-300 rounded transition"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 bg-green-100 px-3 py-1 rounded-md">
                    <span className="text-xs font-medium text-green-700">BTC:</span>
                    <span className="font-mono text-xs text-green-700">{getFormattedBalance('eth')}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded transition"
                  >
                    Logout
                  </button>
                </>
              )}
              {role !== 'supplier' && <ConnectButton />}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-full mx-auto sm:px-6 lg:px-8">
        <div className="flex gap-6">
          <Sidebar />
          <main className="flex-1 py-6">
            {children}
            <KycModal />
          </main>
        </div>
      </div>
    </div>
  );
} 