'use client';

import { useState } from 'react';
import { useKyc } from '@/hooks/useKyc';

export default function VerificationStatusPage() {
  const { status, submit, loading, refresh } = useKyc();
  const [files, setFiles] = useState<File[]>([]);

  const disabled = status === 'verified' || status === 'pending_review';

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Account Verification</h1>
      <div className="rounded-md border p-4 bg-white">
        <div className="text-sm text-gray-700">Current status:</div>
        <div className="mt-1 font-medium capitalize">{status.replace('_', ' ')}</div>

        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">Upload documents (PDF/JPG/PNG)</label>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="block w-full text-sm"
            disabled={disabled}
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50"
            onClick={async () => { await submit(files); await refresh(); }}
            disabled={disabled || files.length === 0 || loading}
          >
            {loading ? 'Submitting...' : 'Submit for review'}
          </button>
          <button className="px-4 py-2 rounded-md border" onClick={refresh}>Refresh</button>
        </div>
      </div>
    </div>
  );
}


