import { type Address } from 'viem';
import stakingAbi from '../../lib/contracts/abis/Staking.json';
import lendingPoolAbi from '../../lib/contracts/abis/LendingPool.json';
import invoiceNFTAbi from '../../lib/contracts/abis/InvoiceNFT.json';
import mockERC20Abi from '../../lib/contracts/abis/MockERC20.json';
import borrowRegistryAbi from '../../lib/contracts/abis/BorrowRegistry.json';


// These addresses will be updated after deployment for avalanche
export const CONTRACT_ADDRESSES = {
  // Mezo Testnet deployed addresses - Dec 2024
  STAKING: '0x9B60E37F3B1468eC277a3eDe9FCe4b79F405D7F4' as Address,
  LENDING_POOL: '0x749eC2d29dd848DF5665Bc0F1AEDFF2F319b85d8' as Address,
  INVOICE_NFT: '0x0dD51695b4df9Ca5abc175aa15F8b8758443Acb3' as Address,
  METRIK_TOKEN: '0x3AA46b59488f0782e3Df1f652D11b4169080a5D0' as Address,
  // MUSD (Mezo USD) Mock - deployed stablecoin
  MUSD: '0x1E882986155F0164eF4243E1D5D876E561C7CC1f' as Address,
  // Keep USDC for backward compatibility (same as MUSD)
  USDC: '0x1E882986155F0164eF4243E1D5D876E561C7CC1f' as Address,
  BORROW_REGISTRY: '0x091564da837331575cED4FE995A2F52BceBCe62E' as Address,
  FAUCET: '0xf5b695D27965604b2CDAd26DC05Ef632C3345c15' as Address,
} as const;

export const CONTRACT_ABIS = {
  STAKING: stakingAbi.abi,
  LENDING_POOL: lendingPoolAbi.abi,
  INVOICE_NFT: invoiceNFTAbi.abi,
  MOCK_ERC20: mockERC20Abi.abi,
  BORROW_REGISTRY: borrowRegistryAbi.abi,
} as const;

export const SUPPORTED_CHAINS = [
  {
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
      websocket: ['wss://rpc-ws.test.mezo.org'],
    },
    blockExplorers: {
      default: { name: 'Mezo Explorer', url: 'https://explorer.test.mezo.org' },
    },
  },
] as const;

// MUSD Token Address on Mezo Testnet (from Mezo documentation)
export const MUSD_TESTNET_ADDRESS = '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503' as Address; 