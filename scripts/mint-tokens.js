const { ethers } = require('ethers');
require('dotenv').config();

// Import ABIs
const MockERC20ABI = require('../src/lib/contracts/abis/MockERC20.json').abi;

// Configuration from environment variables
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL; // Avalanche Fuji testnet
const CHAIN_ID = process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || 43113;

// Contract addresses
const METRIK_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_METRIK_TOKEN_ADDRESS;
const MUSD_ADDRESS = process.env.NEXT_PUBLIC_STABLECOIN_ADDRESS;

// Owner private key
const OWNER_PRIVATE_KEY = process.env.PRIVATE_KEY_OWNER;

// Mint amounts (in wei - adjust as needed)
const METRIK_MINT_AMOUNT = ethers.parseEther('10000000'); // 10 million METRIK tokens
const MUSD_MINT_AMOUNT = ethers.parseUnits('10000000', 6); // 10 million MUSD (6 decimals)

async function mintTokens() {
  try {
    console.log('🚀 Starting token minting script...\n');

    // Validate environment variables
    if (!OWNER_PRIVATE_KEY) {
      throw new Error('OWNER_PRIVATE_KEY not found in environment variables');
    }
    if (!METRIK_TOKEN_ADDRESS) {
      throw new Error('NEXT_PUBLIC_METRIK_TOKEN_ADDRESS not found in environment variables');
    }
    if (!MUSD_ADDRESS) {
      throw new Error('NEXT_PUBLIC_STABLECOIN_ADDRESS not found in environment variables');
    }

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
    const ownerAddress = wallet.address;

    console.log('📋 Configuration:');
    console.log(`   Network: Avalanche Fuji Testnet (Chain ID: ${CHAIN_ID})`);
    console.log(`   Owner Address: ${ownerAddress}`);
    console.log(`   METRIK Token: ${METRIK_TOKEN_ADDRESS}`);
    console.log(`   MUSD Token: ${MUSD_ADDRESS}`);
    console.log(`   METRIK Amount: ${ethers.formatEther(METRIK_MINT_AMOUNT)} tokens`);
    console.log(`   MUSD Amount: ${ethers.formatUnits(MUSD_MINT_AMOUNT, 6)} tokens\n`);

    // Create contract instances
    const metrikContract = new ethers.Contract(METRIK_TOKEN_ADDRESS, MockERC20ABI, wallet);
    const musdContract = new ethers.Contract(MUSD_ADDRESS, MockERC20ABI, wallet);

    // Check if owner has minting rights
    console.log('🔍 Checking minting permissions...');
    
    try {
      const metrikOwner = await metrikContract.owner();
      const musdOwner = await musdContract.owner();
      
      console.log(`   METRIK Token Owner: ${metrikOwner}`);
      console.log(`   MUSD Token Owner: ${musdOwner}`);
      
      if (metrikOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
        console.log('   ⚠️  Warning: Owner address is not the METRIK token owner');
      }
      if (musdOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
        console.log('   ⚠️  Warning: Owner address is not the MUSD token owner');
      }
    } catch (error) {
      console.log('   ⚠️  Could not verify token ownership (this is normal for some contracts)');
    }

    // Get current balances
    console.log('\n💰 Current balances:');
    try {
      const metrikBalance = await metrikContract.balanceOf(ownerAddress);
      const musdBalance = await musdContract.balanceOf(ownerAddress);
      
      console.log(`   METRIK: ${ethers.formatEther(metrikBalance)} tokens`);
      console.log(`   MUSD: ${ethers.formatUnits(musdBalance, 6)} tokens`);
    } catch (error) {
      console.log('   Could not fetch current balances');
    }

    // Mint METRIK tokens
    console.log('\n🪙 Minting METRIK tokens...');
    try {
      const metrikTx = await metrikContract.mint(ownerAddress, METRIK_MINT_AMOUNT);
      console.log(`   Transaction hash: ${metrikTx.hash}`);
      
      const metrikReceipt = await metrikTx.wait();
      console.log(`   ✅ METRIK minting successful! Gas used: ${metrikReceipt.gasUsed.toString()}`);
    } catch (error) {
      console.log(`   ❌ METRIK minting failed: ${error.message}`);
    }

    // Mint MUSD tokens
    console.log('\n💵 Minting MUSD tokens...');
    try {
      const musdTx = await musdContract.mint(ownerAddress, MUSD_MINT_AMOUNT);
      console.log(`   Transaction hash: ${musdTx.hash}`);
      
      const musdReceipt = await musdTx.wait();
      console.log(`   ✅ MUSD minting successful! Gas used: ${musdReceipt.gasUsed.toString()}`);
    } catch (error) {
      console.log(`   ❌ MUSD minting failed: ${error.message}`);
    }

    // Get updated balances
    console.log('\n💰 Updated balances:');
    try {
      const newMetrikBalance = await metrikContract.balanceOf(ownerAddress);
      const newMusdBalance = await musdContract.balanceOf(ownerAddress);
      
      console.log(`   METRIK: ${ethers.formatEther(newMetrikBalance)} tokens`);
      console.log(`   MUSD: ${ethers.formatUnits(newMusdBalance, 6)} tokens`);
    } catch (error) {
      console.log('   Could not fetch updated balances');
    }

    console.log('\n🎉 Token minting script completed!');

  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  mintTokens();
}

module.exports = { mintTokens }; 