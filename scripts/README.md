# Scripts

This directory contains utility scripts for the Metrik frontend.

## Token Minting Scripts

There are two token minting scripts available:

### 1. Basic Minting Script (`mint-tokens.js`)

Mints tokens to the owner address only.


#### Prerequisites

1. **Environment Variables**: Make sure your `.env` file contains:
   - `PRIVATE_KEY_OWNER`: The private key of the owner account
   - `NEXT_PUBLIC_METRIK_TOKEN_ADDRESS`: The deployed METRIK token contract address
   - `NEXT_PUBLIC_STABLECOIN_ADDRESS`: The deployed USDC token contract address
   - `NEXT_PUBLIC_DEFAULT_CHAIN_ID`: The chain ID (defaults to 43113 for Avalanche Fuji)

2. **Network**: The script is configured for Avalanche Fuji testnet by default

3. **Dependencies**: Make sure you have `ethers` installed (it's already in the project dependencies)

#### Usage

```bash
npm run mint-tokens
```

#### What it does

- Mints 1,000,000 METRIK tokens to the owner
- Mints 1,000,000 USDC tokens to the owner
- Shows before and after balances

---

### 2. Advanced Minting Script (`mint-tokens-advanced.js`)

Mints tokens to multiple accounts with different amounts.

#### Prerequisites

Same as basic script, plus:
- `PRIVATE_KEY_SUPPLIER`: Supplier account private key
- `PRIVATE_KEY_LP`: Liquidity Provider account private key  
- `PRIVATE_KEY_BUYER`: Buyer account private key

#### Usage

```bash
npm run mint-tokens-advanced
```

#### What it does

Mints tokens to all configured accounts:

| Account | METRIK Amount | USDC Amount |
|---------|---------------|-------------|
| Owner | 1,000,000 | 1,000,000 |
| Supplier | 100,000 | 500,000 |
| LP | 50,000 | 1,000,000 |
| Buyer | 10,000 | 100,000 |

#### Features

- **Multiple Accounts**: Mints to all accounts that have private keys configured
- **Different Amounts**: Each account gets different token amounts based on their role
- **Balance Tracking**: Shows current balances before and after minting
- **Error Handling**: Continues minting even if one transaction fails
- **Summary Report**: Shows success/failure status for each transaction

---

## Customizing Mint Amounts

### Basic Script

Edit the constants in `mint-tokens.js`:

```javascript
const METRIK_MINT_AMOUNT = ethers.parseEther('1000000'); // Change this value
const USDC_MINT_AMOUNT = ethers.parseUnits('1000000', 6); // Change this value
```

### Advanced Script

Edit the `MINT_CONFIG.targets` array in `mint-tokens-advanced.js`:

```javascript
targets: [
  {
    name: 'Owner',
    privateKey: PRIVATE_KEYS.owner,
    amounts: {
      metrik: '1000000', // Change this value
      usdc: '1000000',   // Change this value
    }
  },
  // ... other targets
]
```

---

## Error Handling

Both scripts include comprehensive error handling:
- Validates all required environment variables
- Checks network connectivity
- Handles transaction failures gracefully
- Provides detailed error messages
- Continues execution even if some transactions fail

---

## Security Notes

⚠️ **Important**: 
- Never commit your private keys to version control
- The scripts use private keys from environment variables
- Make sure your `.env` file is in `.gitignore`
- Only run these scripts on testnets unless you're absolutely sure about the consequences
- The advanced script will attempt to mint to all accounts that have private keys configured

---

## Example Output (Advanced Script)

```
🚀 Starting advanced token minting script...

📋 Configuration:
   Network: Avalanche Fuji Testnet (Chain ID: 43113)
   METRIK Token: 0x1318B4eC51774271e56D2A7DE244E8d51A2528b9
   USDC Token: 0x02F47A52AC94d1D51cC21865e730Cf314fF5C01B

🎯 Minting targets:
   Owner: 0x1234...5678
      METRIK: 1000000 tokens
      USDC: 1000000 tokens
   Supplier: 0xabcd...efgh
      METRIK: 100000 tokens
      USDC: 500000 tokens

💰 Current balances:
   💰 Owner balances:
      METRIK: 0.0 tokens
      USDC: 0.0 tokens
   💰 Supplier balances:
      METRIK: 0.0 tokens
      USDC: 0.0 tokens

🎯 Minting tokens to Owner (0x1234...5678)...
   🪙 Minting 1000000 METRIK tokens...
   Transaction hash: 0xabc...def
   ✅ METRIK minting successful! Gas used: 123456
   💵 Minting 1000000 USDC tokens...
   Transaction hash: 0xdef...abc
   ✅ USDC minting successful! Gas used: 123456

🎯 Minting tokens to Supplier (0xabcd...efgh)...
   🪙 Minting 100000 METRIK tokens...
   Transaction hash: 0xghi...jkl
   ✅ METRIK minting successful! Gas used: 123456
   💵 Minting 500000 USDC tokens...
   Transaction hash: 0xjkl...ghi
   ✅ USDC minting successful! Gas used: 123456

💰 Updated balances:
   💰 Owner balances:
      METRIK: 1000000.0 tokens
      USDC: 1000000.0 tokens
   💰 Supplier balances:
      METRIK: 100000.0 tokens
      USDC: 500000.0 tokens

📊 Minting Summary:
   Owner:
      ✅ METRIK: 0xabc...def
      ✅ USDC: 0xdef...abc
   Supplier:
      ✅ METRIK: 0xghi...jkl
      ✅ USDC: 0xjkl...ghi

🎉 Advanced token minting script completed! 