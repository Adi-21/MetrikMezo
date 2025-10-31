'use client';

import { StakingInterface } from '@/components/contracts/StakingInterface';
import { SupplierStakingHistory } from '@/components/dashboard/SupplierStakingHistory';
import { useState, useEffect } from 'react';
import * as Privy from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { parseUnits, keccak256, toUtf8Bytes } from 'ethers';
import faucetAbi from '@/lib/contracts/abis/Faucet.json';
import { useSendTransaction } from '@privy-io/react-auth';
import { encodeFunctionData } from 'viem';
import { useDisconnect } from 'wagmi';
import { useSeamlessTransaction } from '@/hooks/useSeamlessTransaction';

console.log('Staking page loaded');
console.log('Privy exports:', Privy);

const METRIK_ADDRESS = process.env.NEXT_PUBLIC_METRIK_TOKEN_ADDRESS!;
const FAUCET_ADDRESS = process.env.NEXT_PUBLIC_FAUCET_ADDRESS!;

const MINTER_ROLE = keccak256(toUtf8Bytes("MINTER_ROLE"));

function GrantMinterRoleButton({ address }: { address: string }) {
  const [loading, setLoading] = useState(false);
  const handleGrantRole = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/grant-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: MINTER_ROLE, address }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Minter role granted! Tx: ' + data.txHash);
      } else {
        alert('Error: ' + data.error);
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <button onClick={handleGrantRole} disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 mb-4">
      {loading ? 'Granting...' : 'Get Minter Role'}
    </button>
  );
}



export default function StakingPage() {
  const { ready, authenticated, user } = Privy.usePrivy();
  const { wallets } = Privy.useWallets();
  const { sendTransaction } = useSendTransaction();
  const { executeTransaction } = useSeamlessTransaction();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [showStakingInfo, setShowStakingInfo] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const privyWallet = wallets.find(w => w.walletClientType === 'privy' || (w.meta && w.meta.id === 'io.privy.wallet'));
  const address = privyWallet?.address;

  // Initialize Privy data for staking functionality
  useEffect(() => {
    console.log('🔍 Staking page Privy state:', {
      ready,
      authenticated,
      userEmail: user?.email?.address,
      address,
      walletsLength: wallets.length,
      privyWallet: privyWallet?.address
    });
    
    if (ready && authenticated && user && address) {
      console.log('✅ Privy initialized for staking:', {
        user: user.email?.address,
        address: address,
        walletsLength: wallets.length
      });
    }
  }, [ready, authenticated, user, address, wallets.length, privyWallet]);

  useEffect(() => {
    // Disconnect injected wallets for suppliers
    disconnect();
    console.log('Privy ready:', ready, 'authenticated:', authenticated);
    if (ready && !authenticated) {
      router.push('/');
    }
  }, [ready, authenticated, router, disconnect]);

  if (!ready) return <div>Loading...</div>;
  if (!authenticated) return null;
  if (!address) return <div>Initializing wallet...</div>;

  async function mintMetrik() {
    if (!address) {
      alert("Login first.");
      return;
    }
    setLoading(true);
    try {
      const decimals = 18;
      const amt = BigInt(parseUnits(amount, decimals).toString());
      const data = encodeFunctionData({
        abi: (faucetAbi as any).abi,
        functionName: 'claim',
        args: [METRIK_ADDRESS, amt],
      });
      
      // Use seamless transaction for suppliers
      const hash = await executeTransaction(
        FAUCET_ADDRESS,
        data,
        0n,
        31611 // Mezo Testnet
      );
      
      alert(`Minted ${amount} METRIK to your Privy wallet (${address})! Tx: ${hash}`);
    } catch (err: any) {
      alert(err.message || "Mint failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Staking Information Popup */}
      {showStakingInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Staking Information</h2>
            </div>
            
            <div className="space-y-4 text-gray-700">
              <p className="text-sm leading-relaxed">
                <strong>Important:</strong> The METRIK tokens you stake serve as a <strong>security deposit</strong> that demonstrates your commitment to honest participation in the protocol.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h3 className="font-semibold text-blue-900 mb-2">Key Points:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Not Collateral:</strong> Staked tokens are not used as loan collateral</li>
                  <li>• <strong>Security Deposit:</strong> Shows your honest participation commitment</li>
                  <li>• <strong>Redeemable:</strong> Can be withdrawn after staking period ends</li>
                  <li>• <strong>Risk:</strong> Tokens will be slashed and burned if you default on loans</li>
                </ul>
              </div>
              
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="accept-terms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="accept-terms" className="text-sm text-gray-700">
                  I understand that staked METRIK tokens are security deposits and will be slashed if I default on loans
                </label>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowStakingInfo(false)}
                disabled={!acceptedTerms}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Continue to Staking
              </button>
            </div>
          </div>
        </div>
      )}
      
      <StakingInterface />
      <SupplierStakingHistory />
      <div className="mt-8 border-t pt-6">
        <h2 className="text-lg font-semibold mb-2">Faucet: Mint Metrik</h2>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Amount of Metrik"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="border rounded px-3 py-2 mb-2 w-40"
            disabled={loading}
          />
          <button
            onClick={mintMetrik}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
            disabled={loading || !address}
          >
            Mint Metrik
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">You can mint any amount of Metrik tokens to your wallet.</p>
      </div>
    </div>
  );
} 