'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useKyc } from '@/hooks/useKyc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Lock, Eye } from 'lucide-react';
import ZKKycModal from './ZKKycModal';

export default function KycModal() {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const address = wallets.find(w => w.walletClientType === 'privy' || (w.meta && w.meta.id === 'io.privy.wallet'))?.address;
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [docs, setDocs] = useState<File[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [useZKPrivacy, setUseZKPrivacy] = useState(false);
  const { refresh } = useKyc();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-kyc-modal', handler as any);
    return () => window.removeEventListener('open-kyc-modal', handler as any);
  }, []);

  if (!open) return null;

  const canSubmit = authenticated && (address || user?.email?.address) && companyName && (docs.length + images.length) > 0;

  const close = () => {
    setOpen(false);
    setUseZKPrivacy(false);
  };

  // Show ZK Privacy Modal if enabled
  if (useZKPrivacy && address) {
    return (
      <ZKKycModal
        isOpen={true}
        onClose={close}
        walletAddress={address}
      />
    );
  }

  const uploadToSupabase = async (folder: string, files: File[]) => {
    const urls: string[] = [];
    for (const file of files) {
      const key = `${folder}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('kyc').upload(key, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('kyc').getPublicUrl(key);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const folder = companyName.replace(/\s+/g, '-').toLowerCase();
      const documentUrls = await uploadToSupabase(folder, docs);
      const imageUrls = await uploadToSupabase(`${folder}/images`, images);

      const form = new FormData();
      if (address) form.set('address', address);
      if (!address && user?.email?.address) form.set('email', user.email.address);
      form.set('companyName', companyName);
      form.set('documentUrls', JSON.stringify(documentUrls));
      form.set('imageUrls', JSON.stringify(imageUrls));

      const res = await fetch('/api/kyc/submit', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Submit failed');
      // Immediately refresh KYC status so UI shows pending_review without reload
      try { await refresh(); } catch {}
      alert('KYC submitted. We are reviewing your documents. You will gain access once verified.');
      setOpen(false);
    } catch (e) {
      console.error('KYC submit error', e);
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white w-full max-w-lg rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">KYC Verification</h2>
          <button onClick={close} className="text-gray-500 hover:text-gray-800">✕</button>
        </div>
        
        {/* Privacy Option */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900">Enhanced Privacy Protection</h3>
                <p className="text-sm text-blue-800 mt-1">
                  Protect your personal and business data with cryptographic hashing
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setUseZKPrivacy(true)}
                >
                  <Lock className="h-4 w-4 mr-1" />
                  Use ZK Privacy Protection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Business / Company Name</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Acme Inc" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Documents (PDF/JPG/PNG)</label>
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setDocs(Array.from(e.target.files || []))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Captured Images (optional)</label>
            <input type="file" multiple accept="image/*" onChange={(e) => setImages(Array.from(e.target.files || []))} />
          </div>
          
          {/* Privacy Notice */}
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-start gap-2">
              <Eye className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800">
                  <strong>Standard KYC:</strong> Your data will be stored in our secure database. 
                  Consider using ZK Privacy Protection for enhanced privacy.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={close} className="px-4 py-2 rounded border">Cancel</button>
            <button onClick={submit} disabled={!canSubmit || submitting} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit for review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


