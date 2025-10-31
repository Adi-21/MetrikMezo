export function generateEIP681URI({
  tokenAddress,
  recipient,
  amount, // string, e.g. '100.00'
  decimals = 6,
  chainId = 1,
}: {
  tokenAddress: string;
  recipient: string;
  amount: string;
  decimals?: number;
  chainId?: number;
}) {
  const amountWei = BigInt(Math.floor(Number(amount) * 10 ** decimals)).toString();
  return `ethereum:${tokenAddress}@${chainId}/transfer?address=${recipient}&uint256=${amountWei}`;
} 