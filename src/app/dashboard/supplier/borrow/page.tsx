'use client';

import { useState, useEffect } from 'react';
import { useInvoiceNFT } from '@/hooks/useInvoiceNFT';
import { useLendingPool } from '@/hooks/useLendingPool';
import { useDisconnect } from 'wagmi';
import { BorrowInterface } from '@/components/borrow/BorrowInterface';
import * as Privy from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';

export default function BorrowPage() {
  const { ready, authenticated } = Privy.usePrivy();
  const { wallets } = Privy.useWallets();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const privyWallet = wallets.find(w => w.walletClientType === 'privy' || (w.meta && w.meta.id === 'io.privy.wallet'));
  const address = privyWallet?.address;

  // Debug log for wallets and address
  console.log('BorrowPage wallets:', wallets);
  console.log('BorrowPage address:', address);

  // Only call hooks and render invoice UI if address is ready
  const isAddressReady = !!address && typeof address === 'string' && address.length > 0;

  // Always call hooks, but pass undefined if address is not ready
  const { invoices, getInvoiceDetails, approveInvoice, isInvoiceApproved, fetchInvoices } = useInvoiceNFT(isAddressReady ? address as `0x${string}` : undefined);
  const { borrow, getMaxBorrowAmount } = useLendingPool(isAddressReady ? address as `0x${string}` : undefined);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [selectedMaxBorrow, setSelectedMaxBorrow] = useState<string>('0');
  const [selectedBorrowInput, setSelectedBorrowInput] = useState<string>('');
  const [selectedLoading, setSelectedLoading] = useState<boolean>(false);

  // Disconnect injected wallets for suppliers
  useEffect(() => {
    disconnect();
    if (ready && !authenticated) {
      router.push('/');
    }
  }, [ready, authenticated, router, disconnect]);

  // Update debug info when relevant values change
  useEffect(() => {
    const selectedInvoiceData = invoices.find(inv => inv.id === selectedInvoice);
    console.log('Debug state update:', {
      selectedInvoice,
      selectedInvoiceData,
      invoices: invoices.map(inv => ({ id: inv.id, invoiceId: inv.invoiceId })),
      maxBorrowAmount: selectedMaxBorrow.toString(),
      borrowAmount: selectedBorrowInput
    });
  }, [invoices, selectedInvoice, selectedMaxBorrow, selectedBorrowInput]);

  // When an invoice is selected, fetch its details and max borrow amount
  useEffect(() => {
    if (selectedInvoice) {
      setSelectedLoading(true);
      Promise.all([
        getInvoiceDetails(selectedInvoice),
        getMaxBorrowAmount(selectedInvoice)
      ]).then(([, maxAmount]) => {
        setSelectedMaxBorrow(maxAmount);
      }).catch((err) => {
        console.error(err);
      }).finally(() => {
        setSelectedLoading(false);
      });
    } else {
      setSelectedMaxBorrow('0');
      setSelectedBorrowInput('');
    }
  }, [selectedInvoice, getInvoiceDetails, getMaxBorrowAmount]);

  useEffect(() => {
    if (!selectedLoading && invoices.length > 0) {
      // setHasLoadedOnce(true);
    }
  }, [selectedLoading, invoices.length]);

  const inputAmount = Number(selectedBorrowInput);
  
  // DEBUG: Only show in development
  const isDev = typeof window !== 'undefined' && process.env.NODE_ENV !== 'production';

  useEffect(() => {
    // Removed debug functionality that was causing TypeScript errors
  }, [isDev, fetchInvoices]);

  // Show only verified invoices that the current user owns
  const borrowableInvoices = isAddressReady && invoices.length > 0
    ? invoices
        .filter(inv => inv.isVerified && inv.supplier?.toLowerCase() === address.toLowerCase())
        .map(inv => ({
          ...inv,
          dueDate: inv.dueDate instanceof Date ? inv.dueDate.getTime() / 1000 : inv.dueDate
        }))
    : [];

  // Render logic
  if (!ready) return <div>Loading Privy...</div>;
  if (!authenticated) return null;
  if (!isAddressReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <div className="text-lg font-semibold text-blue-700">Waiting for Privy wallet address...</div>
        <div className="mt-2 animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full max-w-full">
        {/* Borrow stats and history UI */}
        <BorrowInterface invoices={borrowableInvoices} />
      </div>
    </div>
  );
} 