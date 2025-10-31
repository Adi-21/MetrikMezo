const { ethers } = require('ethers');
require('dotenv').config();

// Import ABIs
const MockERC20ABI = require('../src/lib/contracts/abis/MockERC20.json').abi;

// Configuration from environment variables
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL; // Avalanche Fuji testnet
const CHAIN_ID = process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || 43113;

// Contract addresses
const METRIK_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_METRIK_TOKEN_ADDRESS;
const USDC_ADDRESS = process.env.NEXT_PUBLIC_STABLECOIN_ADDRESS;

// Private keys for different accounts
const PRIVATE_KEYS = {
  owner: process.env.PRIVATE_KEY_OWNER,
  supplier: process.env.PRIVATE_KEY_SUPPLIER,
  lp: process.env.PRIVATE_KEY_LP,
  buyer: process.env.PRIVATE_KEY_BUYER,
};

// Configuration object for minting
const MINT_CONFIG = {
  // Default amounts (can be overridden via command line args)
  defaultAmounts: {
    metrik: '1000000', // 1 million METRIK
    usdc: '1000000',   // 1 million USDC
  },
  
  // Target addresses and amounts for minting
  targets: [
    {
      name: 'Owner',
      privateKey: PRIVATE_KEYS.owner,
      amounts: {
        metrik: '1000000', // 1 million METRIK
        usdc: '1000000',   // 1 million USDC
      }
    },
    {
      name: 'Supplier',
      privateKey: PRIVATE_KEYS.supplier,
      amounts: {
        metrik: '100000',  // 100k METRIK
        usdc: '500000',    // 500k USDC
      }
    },
    {
      name: 'LP',
      privateKey: PRIVATE_KEYS.lp,
      amounts: {
        metrik: '50000',   // 50k METRIK
        usdc: '1000000',   // 1 million USDC
      }
    },
    {
      name: 'Buyer',
      privateKey: PRIVATE_KEYS.buyer,
      amounts: {
        metrik: '10000',   // 10k METRIK
        usdc: '100000',    // 100k USDC
      }
    }
  ]
};

async function mintTokensToTarget(target, provider) {
  const wallet = new ethers.Wallet(target.privateKey, provider);
  const address = wallet.address;
  
  console.log(`\n🎯 Minting tokens to ${target.name} (${address})...`);
  
  // Create contract instances
  const metrikContract = new ethers.Contract(METRIK_TOKEN_ADDRESS, MockERC20ABI, wallet);
  const usdcContract = new ethers.Contract(USDC_ADDRESS, MockERC20ABI, wallet);
  
  const results = {
    metrik: { success: false, hash: null, error: null },
    usdc: { success: false, hash: null, error: null }
  };
  
  // Mint METRIK tokens
  if (target.amounts.metrik && target.amounts.metrik !== '0') {
    try {
      const amount = ethers.parseEther(target.amounts.metrik);
      console.log(`   🪙 Minting ${target.amounts.metrik} METRIK tokens...`);
      
      const tx = await metrikContract.mint(address, amount);
      console.log(`   Transaction hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`   ✅ METRIK minting successful! Gas used: ${receipt.gasUsed.toString()}`);
      
      results.metrik = { success: true, hash: tx.hash, gasUsed: receipt.gasUsed };
    } catch (error) {
      console.log(`   ❌ METRIK minting failed: ${error.message}`);
      results.metrik.error = error.message;
    }
  }
  
  // Mint USDC tokens
  if (target.amounts.usdc && target.amounts.usdc !== '0') {
    try {
      const amount = ethers.parseUnits(target.amounts.usdc, 6);
      console.log(`   💵 Minting ${target.amounts.usdc} USDC tokens...`);
      
      const tx = await usdcContract.mint(address, amount);
      console.log(`   Transaction hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`   ✅ USDC minting successful! Gas used: ${receipt.gasUsed.toString()}`);
      
      results.usdc = { success: true, hash: tx.hash, gasUsed: receipt.gasUsed };
    } catch (error) {
      console.log(`   ❌ USDC minting failed: ${error.message}`);
      results.usdc.error = error.message;
    }
  }
  
  return results;
}

async function showBalances(target, provider) {
  const wallet = new ethers.Wallet(target.privateKey, provider);
  const address = wallet.address;
  
  try {
    const metrikContract = new ethers.Contract(METRIK_TOKEN_ADDRESS, MockERC20ABI, provider);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, MockERC20ABI, provider);
    
    const metrikBalance = await metrikContract.balanceOf(address);
    const usdcBalance = await usdcContract.balanceOf(address);
    
    console.log(`   💰 ${target.name} balances:`);
    console.log(`      METRIK: ${ethers.formatEther(metrikBalance)} tokens`);
    console.log(`      USDC: ${ethers.formatUnits(usdcBalance, 6)} tokens`);
  } catch (error) {
    console.log(`   Could not fetch balances for ${target.name}`);
  }
}

async function mintTokensAdvanced() {
  try {
    console.log('🚀 Starting advanced token minting script...\n');
    
    // Validate environment variables
    if (!METRIK_TOKEN_ADDRESS) {
      throw new Error('NEXT_PUBLIC_METRIK_TOKEN_ADDRESS not found in environment variables');
    }
    if (!USDC_ADDRESS) {
      throw new Error('NEXT_PUBLIC_STABLECOIN_ADDRESS not found in environment variables');
    }
    
    // Check if at least one private key is available
    const hasPrivateKey = Object.values(PRIVATE_KEYS).some(key => key);
    if (!hasPrivateKey) {
      throw new Error('No private keys found in environment variables');
    }
    
    // Setup provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    console.log('📋 Configuration:');
    console.log(`   Network: Avalanche Fuji Testnet (Chain ID: ${CHAIN_ID})`);
    console.log(`   METRIK Token: ${METRIK_TOKEN_ADDRESS}`);
    console.log(`   USDC Token: ${USDC_ADDRESS}\n`);
    
    // Show minting targets
    console.log('🎯 Minting targets:');
    MINT_CONFIG.targets.forEach(target => {
      if (target.privateKey) {
        const wallet = new ethers.Wallet(target.privateKey, provider);
        console.log(`   ${target.name}: ${wallet.address}`);
        console.log(`      METRIK: ${target.amounts.metrik} tokens`);
        console.log(`      USDC: ${target.amounts.usdc} tokens`);
      }
    });
    
    // Show current balances
    console.log('\n💰 Current balances:');
    for (const target of MINT_CONFIG.targets) {
      if (target.privateKey) {
        await showBalances(target, provider);
      }
    }
    
    // Mint tokens to each target
    const allResults = [];
    for (const target of MINT_CONFIG.targets) {
      if (target.privateKey) {
        const results = await mintTokensToTarget(target, provider);
        allResults.push({ target: target.name, results });
      }
    }
    
    // Show updated balances
    console.log('\n💰 Updated balances:');
    for (const target of MINT_CONFIG.targets) {
      if (target.privateKey) {
        await showBalances(target, provider);
      }
    }
    
    // Summary
    console.log('\n📊 Minting Summary:');
    allResults.forEach(({ target, results }) => {
      console.log(`   ${target}:`);
      if (results.metrik.success) {
        console.log(`      ✅ METRIK: ${results.metrik.hash}`);
      } else if (results.metrik.error) {
        console.log(`      ❌ METRIK: ${results.metrik.error}`);
      }
      if (results.usdc.success) {
        console.log(`      ✅ USDC: ${results.usdc.hash}`);
      } else if (results.usdc.error) {
        console.log(`      ❌ USDC: ${results.usdc.error}`);
      }
    });
    
    console.log('\n🎉 Advanced token minting script completed!');
    
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  mintTokensAdvanced();
}

module.exports = { mintTokensAdvanced }; 