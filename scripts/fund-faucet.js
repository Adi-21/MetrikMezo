

const { JsonRpcProvider, Wallet, Contract, parseUnits } = require('ethers');
require('dotenv').config();

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY_OWNER;
const METRIK_ADDRESS = process.env.NEXT_PUBLIC_METRIK_TOKEN_ADDRESS;
const MUSD_ADDRESS = process.env.NEXT_PUBLIC_STABLECOIN_ADDRESS;
const FAUCET_ADDRESS = process.env.NEXT_PUBLIC_FAUCET_ADDRESS;

const metrikAbi = require('../src/lib/contracts/abis/MockERC20.json').abi;
const musdAbi = require('../src/lib/contracts/abis/MockERC20.json').abi;
const faucetAbi = [
  { inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'deposit', outputs: [], stateMutability: 'nonpayable', type: 'function' },
];

// Default funding amounts (change via env if desired)
const METRIK_AMOUNT = process.env.FAUCET_METRIK_AMOUNT || '1000000'; // 1,000,000 METRIK
const MUSD_AMOUNT = process.env.FAUCET_MUSD_AMOUNT || '1000000'; // 1,000,000 MUSD

async function main() {
  if (!RPC_URL || !PRIVATE_KEY || !METRIK_ADDRESS || !MUSD_ADDRESS || !FAUCET_ADDRESS) {
    throw new Error('Missing required env vars. Please set NEXT_PUBLIC_RPC_URL, PRIVATE_KEY_OWNER, NEXT_PUBLIC_METRIK_TOKEN_ADDRESS, NEXT_PUBLIC_STABLECOIN_ADDRESS, NEXT_PUBLIC_FAUCET_ADDRESS');
  }

  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);

  const metrik = new Contract(METRIK_ADDRESS, metrikAbi, wallet);
  const musd = new Contract(MUSD_ADDRESS, musdAbi, wallet);
  const faucet = new Contract(FAUCET_ADDRESS, faucetAbi, wallet);

  const metrikAmount = parseUnits(METRIK_AMOUNT, 18);
  const musdAmount = parseUnits(MUSD_AMOUNT, 6);

  console.log('Funder:', wallet.address);
  console.log('Faucet:', FAUCET_ADDRESS);

  // Ensure we have balances; if token supports mint(address,uint256), mint to owner
  try {
    const ownerMetrik = await metrik.balanceOf(wallet.address);
    if (ownerMetrik < metrikAmount && metrik.mint) {
      console.log(`Minting ${METRIK_AMOUNT} METRIK to owner...`);
      const tx = await metrik.mint(wallet.address, metrikAmount);
      await tx.wait();
    }
  } catch (_) {}
  try {
    const ownerMusd = await musd.balanceOf(wallet.address);
    if (ownerMusd < musdAmount && musd.mint) {
      console.log(`Minting ${MUSD_AMOUNT} MUSD to owner...`);
      const tx = await musd.mint(wallet.address, musdAmount);
      await tx.wait();
    }
  } catch (_) {}

  // Approve faucet to pull tokens
  console.log(`Approving faucet for ${METRIK_AMOUNT} METRIK...`);
  let tx = await metrik.approve(FAUCET_ADDRESS, metrikAmount);
  await tx.wait();
  console.log('Approved METRIK');

  console.log(`Approving faucet for ${MUSD_AMOUNT} MUSD...`);
  tx = await musd.approve(FAUCET_ADDRESS, musdAmount);
  await tx.wait();
  console.log('Approved MUSD');

  // Deposit into faucet (transfersFrom owner -> faucet)
  console.log('Depositing METRIK into faucet...');
  tx = await faucet.deposit(METRIK_ADDRESS, metrikAmount);
  await tx.wait();
  console.log('Deposited METRIK');

  console.log('Depositing MUSD into faucet...');
  tx = await faucet.deposit(MUSD_ADDRESS, musdAmount);
  await tx.wait();
  console.log('Deposited MUSD');

  // Log final faucet balances
  const faucetMetrik = await metrik.balanceOf(FAUCET_ADDRESS);
  const faucetMusd = await musd.balanceOf(FAUCET_ADDRESS);
  console.log('Faucet balances:', {
    metrik: faucetMetrik.toString(),
    musd: faucetMusd.toString(),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


