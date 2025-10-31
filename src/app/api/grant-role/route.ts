import { NextRequest } from 'next/server';
import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes, isHexString } from 'ethers';
import invoiceNFTArtifact from '@/lib/contracts/abis/InvoiceNFT.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

console.log('DEBUG: Node.js version:', process.version);

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const CHAIN_ID = process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID; // optional; will be validated against provider
const PRIVATE_KEY_OWNER = process.env.PRIVATE_KEY_OWNER;
const INVOICE_NFT_ADDRESS = process.env.NEXT_PUBLIC_INVOICE_NFT_ADDRESS;

function jsonError(message: string, details?: unknown, status = 500) {
  return new Response(JSON.stringify({ error: message, details }), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(request: NextRequest) {
  const { role, address } = await request.json();
  if (!role || !address) {
    return jsonError('Missing role or address', { role, address }, 400);
  }

  try {
    // Validate envs early with explicit messages
    if (!RPC_URL) return jsonError('Missing NEXT_PUBLIC_RPC_URL');
    if (!INVOICE_NFT_ADDRESS) return jsonError('Missing NEXT_PUBLIC_INVOICE_NFT_ADDRESS');
    if (!PRIVATE_KEY_OWNER) return jsonError('Missing PRIVATE_KEY_OWNER (server-side only)');

    // Direct fetch test
    console.log('DEBUG: Testing direct fetch to RPC_URL...');
    const fetchRes = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    });
    const fetchData = await fetchRes.text();
    console.log('DEBUG: fetch direct result:', fetchData);

    console.log('DEBUG: Creating provider...');
    // Some hosts require an explicit Network object for non-default chains (e.g., Mezo Testnet)
    const expectedChainId = Number(CHAIN_ID || '31611');
    const provider = new JsonRpcProvider(RPC_URL, { name: 'avalancheFuji', chainId: expectedChainId });
    console.log('DEBUG: Provider created. Getting block number...');
    const block = await provider.getBlockNumber();
    console.log('DEBUG: Block number from provider:', block);

    // Validate network if CHAIN_ID is provided
    try {
      const net = await provider.getNetwork();
      console.log('DEBUG: Provider network:', net.chainId);
      if (expectedChainId) {
        const expected = expectedChainId;
        if (Number(net.chainId) !== expected) {
          return jsonError('Network mismatch', { provider: Number(net.chainId), env: expected }, 500);
        }
      }
    } catch (e) {
      console.warn('DEBUG: Network validation warning:', e);
      if (expectedChainId) throw e; // enforce if specified
    }

    console.log('DEBUG: Creating wallet...');
    const wallet = new Wallet(PRIVATE_KEY_OWNER as string);
    const signer = wallet.connect(provider);
    console.log('DEBUG: Wallet created. Address:', await signer.getAddress());

    console.log('DEBUG: Creating contract...');
    const contract = new Contract(INVOICE_NFT_ADDRESS as string, invoiceNFTArtifact.abi, signer);
    console.log('DEBUG: Contract created. Address:', contract.target);

    // Normalize role to bytes32: accept 0x…64 or role name like "MINTER_ROLE"
    let roleBytes32: string;
    if (typeof role === 'string' && isHexString(role) && role.length === 66) {
      roleBytes32 = role;
    } else if (typeof role === 'string') {
      roleBytes32 = keccak256(toUtf8Bytes(role));
    } else {
      return jsonError('Invalid role format', { role }, 400);
    }

    console.log('DEBUG: Sending grantRole transaction...');
    const tx = await contract.grantRole(roleBytes32, address);
    await tx.wait();
    console.log('DEBUG: grantRole transaction sent. Tx hash:', tx.hash);
    return new Response(JSON.stringify({ success: true, txHash: tx.hash }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: unknown) {
    console.error('DEBUG: Error in grant-role API:', err);
    const e = err as Error;
    return jsonError(e.message || 'Unknown error', { stack: e.stack });
  }
} 