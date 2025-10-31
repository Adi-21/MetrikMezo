import React, { useState, useEffect } from 'react';
import { useInvoiceNFT } from '@/hooks/useInvoiceNFT';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, History, BarChart3, FileText, Flame, CheckCircle } from 'lucide-react';
import { useWallets } from '@privy-io/react-auth';
import { formatAmount } from '@/lib/utils/contracts';

export function HistoricalInvoiceInterface() {
  const { wallets } = useWallets();
  const privyWallet = wallets.find(w => w.walletClientType === 'privy' || (w.meta && w.meta.id === 'io.privy.wallet'));
  const address = privyWallet?.address;

  const {
    getHistoricalInvoiceRecord,
    getUserInvoiceStatistics,
    getUserMintedTokens,
    getUserBurnedTokens,
    searchInvoiceById,
    getUserHistoricalRecords,
    error,
  } = useInvoiceNFT(address as `0x${string}`);

  const [searchTokenId, setSearchTokenId] = useState('');
  const [searchInvoiceId, setSearchInvoiceId] = useState('');
  const [historicalRecord, setHistoricalRecord] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [mintedTokens, setMintedTokens] = useState<bigint[]>([]);
  const [burnedTokens, setBurnedTokens] = useState<bigint[]>([]);
  const [historicalRecords, setHistoricalRecords] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch user statistics on component mount
  useEffect(() => {
    if (address) {
      fetchUserStats();
      fetchUserTokens();
    }
  }, [address]);

  const fetchUserStats = async () => {
    if (!address) return;
    setIsSearching(true);
    try {
      const stats = await getUserInvoiceStatistics(address as `0x${string}`);
      setUserStats(stats);
      console.log('User statistics:', stats);
    } catch (err) {
      console.error('Error fetching user stats:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchUserTokens = async () => {
    if (!address) return;
    setIsSearching(true);
    try {
      const [minted, burned] = await Promise.all([
        getUserMintedTokens(address as `0x${string}`),
        getUserBurnedTokens(address as `0x${string}`)
      ]);
      setMintedTokens(minted);
      setBurnedTokens(burned);
      console.log('User tokens - Minted:', minted, 'Burned:', burned);
    } catch (err) {
      console.error('Error fetching user tokens:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchByTokenId = async () => {
    if (!searchTokenId) return;
    setIsSearching(true);
    try {
      const record = await getHistoricalInvoiceRecord(searchTokenId);
      setHistoricalRecord(record);
      console.log('Historical record for token', searchTokenId, ':', record);
    } catch (err) {
      console.error('Error searching by token ID:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchByInvoiceId = async () => {
    if (!searchInvoiceId) return;
    setIsSearching(true);
    try {
      const record = await searchInvoiceById(searchInvoiceId);
      setHistoricalRecord(record);
      console.log('Search result for invoice ID', searchInvoiceId, ':', record);
    } catch (err) {
      console.error('Error searching by invoice ID:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFetchHistoricalRecords = async () => {
    if (!address) return;
    setIsSearching(true);
    try {
      const records = await getUserHistoricalRecords(address as `0x${string}`, 0, 10);
      setHistoricalRecords(records);
      console.log('Historical records:', records);
    } catch (err) {
      console.error('Error fetching historical records:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString();
  };

  const getStatusBadge = (isBurned: boolean, burnReason: string) => {
    if (isBurned) {
      return (
        <Badge variant="destructive">
          <Flame className="w-3 h-3 mr-1" />
          Burned ({burnReason})
        </Badge>
      );
    }
    return (
      <Badge variant="default">
        <CheckCircle className="w-3 h-3 mr-1" />
        Active
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Historical Invoice Data
          </CardTitle>
          <CardDescription>
            Access complete invoice history including burned/repaid invoices using new contract functions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="search" className="space-y-4">
            <TabsList>
              <TabsTrigger value="search">Search Invoices</TabsTrigger>
              <TabsTrigger value="stats">User Statistics</TabsTrigger>
              <TabsTrigger value="history">Historical Records</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Search by Token ID</CardTitle>
                    <CardDescription>Find invoice by NFT token ID (works for burned ones)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="tokenId">Token ID</Label>
                      <Input
                        id="tokenId"
                        placeholder="Enter token ID (e.g., 6)"
                        value={searchTokenId}
                        onChange={(e) => setSearchTokenId(e.target.value)}
                      />
                    </div>
                    <Button 
                      onClick={handleSearchByTokenId} 
                      disabled={isSearching || !searchTokenId}
                      className="w-full"
                    >
                      {isSearching ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Search by Token ID
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Search by Invoice ID</CardTitle>
                    <CardDescription>Find invoice by invoice ID (works for burned ones)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="invoiceId">Invoice ID</Label>
                      <Input
                        id="invoiceId"
                        placeholder="Enter invoice ID"
                        value={searchInvoiceId}
                        onChange={(e) => setSearchInvoiceId(e.target.value)}
                      />
                    </div>
                    <Button 
                      onClick={handleSearchByInvoiceId} 
                      disabled={isSearching || !searchInvoiceId}
                      className="w-full"
                    >
                      {isSearching ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Search by Invoice ID
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {historicalRecord && (
                <Card>
                  <CardHeader>
                    <CardTitle>Search Result</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Token ID</Label>
                        <p className="text-lg font-mono">{historicalRecord.tokenId?.toString()}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Invoice ID</Label>
                        <p className="text-lg">{historicalRecord.invoiceId}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Supplier</Label>
                        <p className="text-sm font-mono">{historicalRecord.supplier}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Credit Amount</Label>
                        <p className="text-lg">{formatAmount(historicalRecord.creditAmount, 6)} MUSD</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Due Date</Label>
                        <p className="text-sm">{formatDate(historicalRecord.dueDate)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Status</Label>
                        <div className="mt-1">
                          {getStatusBadge(historicalRecord.isBurned, historicalRecord.burnReason)}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Mint Time</Label>
                        <p className="text-sm">{formatDate(historicalRecord.mintTime)}</p>
                      </div>
                      {historicalRecord.isBurned && (
                        <div>
                          <Label className="text-sm font-medium">Burn Time</Label>
                          <p className="text-sm">{formatDate(historicalRecord.burnTime)}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="stats" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    User Invoice Statistics
                  </CardTitle>
                  <CardDescription>Complete statistics for your invoice activity</CardDescription>
                </CardHeader>
                <CardContent>
                  {isSearching ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : userStats ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{userStats.totalMinted?.toString()}</div>
                        <div className="text-sm text-gray-600">Total Minted</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{userStats.totalBurned?.toString()}</div>
                        <div className="text-sm text-gray-600">Total Burned</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{userStats.totalActive?.toString()}</div>
                        <div className="text-sm text-gray-600">Active</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {formatAmount(userStats.totalCreditAmount, 6)}
                        </div>
                        <div className="text-sm text-gray-600">Total Credit (MUSD)</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No statistics available
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Minted Tokens</CardTitle>
                    <CardDescription>All tokens you&apos;ve minted</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {mintedTokens.length > 0 ? (
                      <div className="space-y-2">
                        {mintedTokens.map((tokenId, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="font-mono text-sm">Token #{tokenId.toString()}</span>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">No minted tokens found</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Burned Tokens</CardTitle>
                    <CardDescription>All tokens you&apos;ve burned (repaid)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {burnedTokens.length > 0 ? (
                      <div className="space-y-2">
                        {burnedTokens.map((tokenId, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded">
                            <span className="font-mono text-sm">Token #{tokenId.toString()}</span>
                            <Flame className="w-4 h-4 text-red-600" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">No burned tokens found</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Historical Records
                  </CardTitle>
                  <CardDescription>Paginated historical invoice records</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={handleFetchHistoricalRecords} 
                    disabled={isSearching || !address}
                    className="mb-4"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <History className="mr-2 h-4 w-4" />
                        Load Historical Records
                      </>
                    )}
                  </Button>

                  {historicalRecords.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Token ID</TableHead>
                          <TableHead>Invoice ID</TableHead>
                          <TableHead>Credit Amount</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Mint Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historicalRecords.map((record, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono">#{record.tokenId?.toString()}</TableCell>
                            <TableCell>{record.invoiceId}</TableCell>
                            <TableCell>{formatAmount(record.creditAmount, 6)} MUSD</TableCell>
                            <TableCell>{formatDate(record.dueDate)}</TableCell>
                            <TableCell>
                              {getStatusBadge(record.isBurned, record.burnReason)}
                            </TableCell>
                            <TableCell>{formatDate(record.mintTime)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
} 