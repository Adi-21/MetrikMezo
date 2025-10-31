'use client';

import { LendingInterface } from '@/components/contracts/LendingInterface';
import { LPDepositHistory } from '@/components/dashboard/LPDepositHistory';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { BrowserProvider, Contract, parseUnits } from "ethers";
import faucetAbi from '@/lib/contracts/abis/Faucet.json';
import { useTokenBalance } from '@/hooks/useTokenBalance';

const MUSD_ADDRESS = process.env.NEXT_PUBLIC_STABLECOIN_ADDRESS!;
const FAUCET_ADDRESS = process.env.NEXT_PUBLIC_FAUCET_ADDRESS!;

console.log('🔍 LP Deposit Page - MUSD Address from env:', MUSD_ADDRESS);
console.log('🔍 LP Deposit Page - FAUCET Address from env:', FAUCET_ADDRESS);

export default function LPDepositPage() {
  const { address, isConnected } = useAccount();
  const { refreshBalances, refetchMusdBalance } = useTokenBalance();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function mintMUSD() {
    if (!window.ethereum || !address) {
      alert("Connect your wallet first.");
      return;
    }
    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum as unknown as any);
      const signer = await provider.getSigner();
      const faucet = new Contract(FAUCET_ADDRESS, (faucetAbi as any).abi, signer);
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        alert("Enter a valid amount");
        setLoading(false);
        return;
      }
      const decimals = 6;
      const amt = parseUnits(amount, decimals);
      const tx = await faucet.claim(MUSD_ADDRESS, amt);
      await tx.wait();
      alert(`Minted ${amount} MUSD to your wallet!`);
      
      // Refresh balances after successful mint
      setTimeout(() => {
        console.log('🔄 Calling refreshBalances after mint...');
        refreshBalances();
        console.log('🔄 Calling refetchMusdBalance after mint...');
        refetchMusdBalance();
      }, 2000); // Wait 2 seconds for blockchain to update
    } catch (err: unknown) {
      alert((err as Error).message || "Mint failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <LendingInterface />
      <LPDepositHistory />
      <div className="mt-8 border-t pt-6">
        <h2 className="text-lg font-semibold mb-2">Faucet: Mint MUSD</h2>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Amount of MUSD"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="border rounded px-3 py-2 mb-2 w-40"
            disabled={loading}
          />
          <button
            onClick={mintMUSD}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            disabled={loading || !isConnected}
          >
            Mint MUSD
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">You can mint any amount of MUSD tokens to your wallet.</p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => {
              console.log('🔄 Manual refreshBalances clicked');
              refreshBalances();
            }}
            className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
          >
            Refresh Balance (Manual)
          </button>
          <button
            onClick={() => {
              console.log('🔄 Manual refetchMusdBalance clicked');
              refetchMusdBalance();
            }}
            className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
          >
            Refresh MUSD (Wagmi)
          </button>
        </div>
      </div>
    </div>
  );
} 