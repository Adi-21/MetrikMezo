'use client';

import { WagmiProvider as WagmiProviderV2, createConfig, http } from 'wagmi';
import { type ReactNode } from 'react';

// Mezo Testnet chain config
const mezoTestnet = {
  id: 31611,
  name: 'Mezo Testnet',
  network: 'mezo-testnet',
  nativeCurrency: {
    name: 'Bitcoin',
    symbol: 'BTC',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.test.mezo.org'] },
    public: { http: ['https://rpc.test.mezo.org'] },
  },
  blockExplorers: {
    default: { name: 'Mezo Explorer', url: 'https://explorer.test.mezo.org' },
  },
};

const config = createConfig({
  chains: [mezoTestnet],
  transports: {
    [mezoTestnet.id]: http('https://rpc.test.mezo.org'),
  },
});

export function WagmiProvider({ children }: { children: ReactNode }) {
  return <WagmiProviderV2 config={config}>{children}</WagmiProviderV2>;
} 