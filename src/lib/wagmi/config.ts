import { http } from 'wagmi';
import { createConfig } from 'wagmi';
import { type Chain } from 'viem';
import { CONTRACT_ADDRESSES } from '../contracts/config';
import { type Abi } from 'viem';
import stakingAbi from '../../lib/contracts/abis/Staking.json';
import lendingPoolAbi from '../../lib/contracts/abis/LendingPool.json';
import invoiceNFTAbi from '../../lib/contracts/abis/InvoiceNFT.json';
import mockERC20Abi from '../../lib/contracts/abis/MockERC20.json';
import borrowRegistryAbi from '../../lib/contracts/abis/BorrowRegistry.json';

// Mezo Testnet chain config
export const mezoTestnet: Chain = {
  id: 31611,
  name: 'Mezo Testnet',
  nativeCurrency: {
    name: 'Bitcoin',
    symbol: 'BTC',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.test.mezo.org'], webSocket: ['wss://rpc-ws.test.mezo.org'] },
    public: { http: ['https://rpc.test.mezo.org'], webSocket: ['wss://rpc-ws.test.mezo.org'] },
  },
  blockExplorers: {
    default: { name: 'Mezo Explorer', url: 'https://explorer.test.mezo.org' },
  },
  testnet: true,
} as const;

export const SUPPORTED_CHAINS = [mezoTestnet] as const satisfies readonly [Chain, ...Chain[]];

export const CONTRACT_ABIS = {
  STAKING: stakingAbi.abi,
  LENDING_POOL: lendingPoolAbi.abi,
  INVOICE_NFT: invoiceNFTAbi.abi,
  MOCK_ERC20: mockERC20Abi.abi,
  BORROW_REGISTRY: borrowRegistryAbi.abi,
} as const;

export const config = createConfig({
  chains: SUPPORTED_CHAINS,
  transports: {
    [SUPPORTED_CHAINS[0].id]: http('https://rpc.test.mezo.org'),
  },
});


export const contracts = {
  staking: {
    address: CONTRACT_ADDRESSES.STAKING as `0x${string}`,
    abi: CONTRACT_ABIS.STAKING as Abi,
  },
  lendingPool: {
    address: CONTRACT_ADDRESSES.LENDING_POOL as `0x${string}`,
    abi: CONTRACT_ABIS.LENDING_POOL as Abi,
  },
  invoiceNFT: {
    address: CONTRACT_ADDRESSES.INVOICE_NFT as `0x${string}`,
    abi: CONTRACT_ABIS.INVOICE_NFT as Abi,
  },
  metrikToken: {
    address: CONTRACT_ADDRESSES.METRIK_TOKEN as `0x${string}`,
    abi: CONTRACT_ABIS.MOCK_ERC20 as Abi,
  },
  // MUSD (Mezo USD) - primary stablecoin
  musd: {
    address: CONTRACT_ADDRESSES.MUSD as `0x${string}`,
    abi: CONTRACT_ABIS.MOCK_ERC20 as Abi,
  },
  // MUSD kept for backward compatibility during migration
  usdc: {
    address: CONTRACT_ADDRESSES.USDC as `0x${string}`,
    abi: CONTRACT_ABIS.MOCK_ERC20 as Abi,
  },
} as const; 