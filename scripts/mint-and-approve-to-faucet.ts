import { JsonRpcProvider, Wallet, Contract, parseUnits } from "ethers";
import * as dotenv from "dotenv";
import metrikAbi from "../src/lib/contracts/abis/MockERC20.json";
import musdAbi from "../src/lib/contracts/abis/MockERC20.json";

dotenv.config();

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY_OWNER!;
const METRIK_ADDRESS = process.env.NEXT_PUBLIC_METRIK_TOKEN_ADDRESS!;
const MUSD_ADDRESS = process.env.NEXT_PUBLIC_STABLECOIN_ADDRESS!; // Now MUSD
const FAUCET_ADDRESS = process.env.NEXT_PUBLIC_FAUCET_ADDRESS!;

// Set the amount to mint and approve (as string, e.g., "1000000")
const METRIK_AMOUNT = "9999000000";
const MUSD_AMOUNT = "9999000000"; // Changed from USDC_AMOUNT to MUSD_AMOUNT

async function main() {
  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);

  // Mint METRIK
  const metrik = new Contract(METRIK_ADDRESS, metrikAbi.abi, wallet);
  const metrikDecimals = 18;
  const metrikAmount = parseUnits(METRIK_AMOUNT, metrikDecimals);
  console.log(`Minting ${METRIK_AMOUNT} METRIK to ${wallet.address}...`);
  let tx = await metrik.mint(wallet.address, metrikAmount);
  await tx.wait();
  console.log(`Minted METRIK. Tx: ${tx.hash}`);

  // Approve METRIK to Faucet (full 1,000,000 METRIK)
  console.log(`Approving Faucet to spend ${METRIK_AMOUNT} METRIK...`);
  tx = await metrik.approve(FAUCET_ADDRESS, metrikAmount);
  await tx.wait();
  console.log(`Approved METRIK. Tx: ${tx.hash}`);

  // Mint MUSD (changed from USDC)
  const musd = new Contract(MUSD_ADDRESS, musdAbi.abi, wallet);
  const musdDecimals = 6; // MUSD has 6 decimals like USDC
  const musdAmount = parseUnits(MUSD_AMOUNT, musdDecimals);
  console.log(`Minting ${MUSD_AMOUNT} MUSD to ${wallet.address}...`);
  tx = await musd.mint(wallet.address, musdAmount);
  await tx.wait();
  console.log(`Minted MUSD. Tx: ${tx.hash}`);

  // Approve MUSD to Faucet (full 1,000,000 MUSD)
  console.log(`Approving Faucet to spend ${MUSD_AMOUNT} MUSD...`);
  tx = await musd.approve(FAUCET_ADDRESS, musdAmount);
  await tx.wait();
  console.log(`Approved MUSD. Tx: ${tx.hash}`);

  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 