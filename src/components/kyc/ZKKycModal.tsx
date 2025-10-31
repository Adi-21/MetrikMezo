'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useZKKyc } from '@/lib/zk/zkKycService';
import { toast } from 'react-toastify';
import { Shield, Eye, EyeOff, FileText } from 'lucide-react';

interface ZKKycModalProps {
    isOpen: boolean;
    onClose: () => void;
    walletAddress: string;
}

export default function ZKKycModal({ isOpen, onClose, walletAddress }: ZKKycModalProps) {
    const [companyName, setCompanyName] = useState('');
    const [docs, setDocs] = useState<File[]>([]);
    const [images, setImages] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);

    const { submitZKKyc, isLoading } = useZKKyc();

    const canSubmit = companyName && (docs.length + images.length) > 0;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);

        try {
            // Submit ONLY to ZK privacy system (no plaintext storage)
            await submitZKKyc({
                companyName,
                documents: [...docs, ...images]
            }, walletAddress);

            toast.success('KYC submitted with ZK privacy protection. We are reviewing your documents.');
            onClose();
        } catch (error) {
            console.error('Error submitting KYC:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to submit KYC');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDocsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setDocs(prev => [...prev, ...files]);
    };

    const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setImages(prev => [...prev, ...files]);
    };

    const removeDoc = (index: number) => {
        setDocs(prev => prev.filter((_, i) => i !== index));
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white w-full max-w-lg rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">ZK Privacy KYC Verification</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">✕</button>
                </div>

                {/* ZK Privacy Notice */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                    <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-blue-900">ZK Privacy Protection Active</h3>
                            <p className="text-sm text-blue-800 mt-1">
                                Your data is protected with cryptographic hashing. Only verification status is stored.
                            </p>
                            <Button
                                variant="link"
                                className="p-0 h-auto text-blue-600"
                                onClick={() => setShowPrivacyInfo(!showPrivacyInfo)}
                            >
                                {showPrivacyInfo ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                                {showPrivacyInfo ? 'Hide' : 'Show'} Privacy Details
                            </Button>
                        </div>
                    </div>

                    {showPrivacyInfo && (
                        <div className="mt-3 text-sm text-blue-700">
                            <ul className="list-disc list-inside space-y-1">
                                <li>Company name is cryptographically hashed before storage</li>
                                <li>Documents are hashed and stored as proof of existence</li>
                                <li>Only hash values are stored, not actual data</li>
                                <li>Verification can be done without exposing sensitive information</li>
                            </ul>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Business / Company Name</label>
                        <input
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full border rounded px-3 py-2"
                            placeholder="Acme Inc"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Documents (PDF/JPG/PNG)</label>
                        <input
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleDocsUpload}
                        />
                        {docs.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {docs.map((doc, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-gray-600" />
                                            <span className="text-sm">{doc.name}</span>
                                            <Badge variant="secondary" className="text-xs">
                                                {(doc.size / 1024 / 1024).toFixed(2)} MB
                                            </Badge>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => removeDoc(index)}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Captured Images (optional)</label>
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleImagesUpload}
                        />
                        {images.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {images.map((img, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-gray-600" />
                                            <span className="text-sm">{img.name}</span>
                                            <Badge variant="secondary" className="text-xs">
                                                {(img.size / 1024 / 1024).toFixed(2)} MB
                                            </Badge>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => removeImage(index)}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="px-4 py-2 rounded border">Cancel</button>
                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit || submitting}
                            className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50"
                        >
                            {submitting ? 'Submitting with Privacy Protection...' : 'Submit for review'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}