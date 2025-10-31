'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

export type KycStatus = 'not_submitted' | 'pending_review' | 'verified' | 'rejected';

export function useKyc() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const address = wallets.find(w => w.walletClientType === 'privy' || (w.meta && w.meta.id === 'io.privy.wallet'))?.address;

  const [status, setStatus] = useState<KycStatus>('not_submitted');
  const [loading, setLoading] = useState(false);

  const email = useMemo(() => user?.email?.address || undefined, [user]);

  const refresh = useCallback(async () => {
    if (!ready) return;
    const qs = new URLSearchParams();
    if (address) qs.set('address', address);
    if (email && !address) qs.set('email', email);
    const res = await fetch(`/api/kyc/status?${qs.toString()}`, { cache: 'no-store' });
    const data = await res.json();
    setStatus(data.kycStatus as KycStatus);
  }, [ready, address, email]);

  useEffect(() => {
    if (authenticated) {
      refresh();
    }
  }, [authenticated, refresh]);

  // React to global KYC updates triggered elsewhere (e.g., KycModal)
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('kyc-status-updated', handler as any);
    return () => window.removeEventListener('kyc-status-updated', handler as any);
  }, [refresh]);

  const submit = useCallback(async (files: File[]) => {
    if (!authenticated) throw new Error('Not authenticated');
    setLoading(true);
    try {
      const form = new FormData();
      if (address) form.set('address', address);
      if (!address && email) form.set('email', email);
      for (const f of files) form.append('file', f);
      const res = await fetch('/api/kyc/submit', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Submit failed');
      // Optimistic update
      setStatus('pending_review');
      // Broadcast so other hook instances refresh
      window.dispatchEvent(new CustomEvent('kyc-status-updated'));
      return true;
    } finally {
      setLoading(false);
    }
  }, [authenticated, address, email]);

  return { status, submit, refresh, loading };
}


