import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth';

export function SupplierLoginButton() {
  const { login, ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const privyWallet = wallets.find(w => w.walletClientType === 'privy' || (w.meta && w.meta.id === 'io.privy.wallet'));
  const address = privyWallet?.address;

  if (!ready) return <button disabled>Loading...</button>;
  if (authenticated) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-gray-600">Welcome, {user?.email?.address || 'Supplier'}!</div>
        <div className="text-xs text-gray-500">Wallet: {address ? `${address.slice(0, 8)}...${address.slice(-4)}` : 'Loading...'}</div>
        <div className="text-xs text-gray-400">Debug: {address}</div>
      </div>
    );
  }

  return (
    <button onClick={login} className="px-4 py-2 bg-blue-600 text-white rounded">
      Login as Supplier
    </button>
  );
} 