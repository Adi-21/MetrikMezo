import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes } from "ethers";
import * as dotenv from "dotenv";
// If you haven't already, run: npm install dotenv @types/dotenv --save-dev
import invoiceNFTArtifact from "../src/lib/contracts/abis/InvoiceNFT.json";
const invoiceNFTAbi = invoiceNFTArtifact.abi;

dotenv.config();

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL!;
const PRIVATE_KEY_ADMIN = process.env.PRIVATE_KEY_OWNER!; // Admin who can grant roles
const INVOICE_NFT_ADDRESS = process.env.NEXT_PUBLIC_INVOICE_NFT_ADDRESS!;
const SUPPLIER_ADDRESS = process.env.SUPPLIER_ADDRESS!; // Add this to your .env
const OWNER_ADDRESS = process.env.OWNER_ADDRESS!; // Add this to your .env

// Role hashes (keccak256)
const MINTER_ROLE = keccak256(toUtf8Bytes("MINTER_ROLE"));
const VERIFIER_ROLE = keccak256(toUtf8Bytes("VERIFIER_ROLE"));

async function main() {
  if (!RPC_URL || !PRIVATE_KEY_ADMIN || !INVOICE_NFT_ADDRESS || !SUPPLIER_ADDRESS || !OWNER_ADDRESS) {
    throw new Error("Missing required environment variables. Check your .env file.");
  }
  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY_ADMIN, provider);
  const contract = new Contract(INVOICE_NFT_ADDRESS, invoiceNFTAbi, wallet);

  // Grant MINTER_ROLE to supplier if not already granted
  const hasMinter = await contract.hasRole(MINTER_ROLE, SUPPLIER_ADDRESS);
  if (!hasMinter) {
    console.log(`Granting MINTER_ROLE to ${SUPPLIER_ADDRESS}...`);
    const tx = await contract.grantRole(MINTER_ROLE, SUPPLIER_ADDRESS);
    await tx.wait();
    console.log("MINTER_ROLE granted!");
  } else {
    console.log("Supplier already has MINTER_ROLE.");
  }

  // Grant VERIFIER_ROLE to owner if not already granted
  const hasVerifier = await contract.hasRole(VERIFIER_ROLE, OWNER_ADDRESS);
  if (!hasVerifier) {
    console.log(`Granting VERIFIER_ROLE to ${OWNER_ADDRESS}...`);
    const tx = await contract.grantRole(VERIFIER_ROLE, OWNER_ADDRESS);
    await tx.wait();
    console.log("VERIFIER_ROLE granted!");
  } else {
    console.log("Owner already has VERIFIER_ROLE.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 