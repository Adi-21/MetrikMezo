'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { ReactNode } from 'react';
import { WagmiProvider } from '../components/providers/WagmiProvider';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { PrivyProvider } from '@privy-io/react-auth';

const inter = Inter({ subsets: ["latin"] });

const mezoTestnet = {
  id: 31611,
  name: 'Mezo Testnet',
  rpcUrls: {
    default: { http: ['https://rpc.test.mezo.org'] },
    public: { http: ['https://rpc.test.mezo.org'] },
  },
  blockExplorers: {
    default: { name: 'Mezo Explorer', url: 'https://explorer.test.mezo.org' },
  },
  nativeCurrency: {
    name: 'Bitcoin',
    symbol: 'BTC',
    decimals: 18,
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={inter.className}>
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmd45wlum039ql20myccjcwpv"}
          config={{
            loginMethods: ['email'],
            appearance: {
              theme: 'light',
              accentColor: '#0070f3',
            },
            supportedChains: [mezoTestnet],
            // Ensure proper user isolation
            defaultChain: mezoTestnet,
            embeddedWallets: {
              createOnLogin: 'users-without-wallets',
              showWalletUIs: true, // Enable wallet confirmation modals
            },
            // Use embedded wallets instead of session signers for now
            // sessionSigners: {
            //   enabled: true,
            // },
          }}
        >
        <WagmiProvider>
          <Web3Provider>
            {children}
            <ToastContainer
              position="top-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="light"
            />
          </Web3Provider>
        </WagmiProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}
