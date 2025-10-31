'use client';

import { useState } from 'react';
import { useLiquidation } from '@/hooks/useLiquidation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Shield, Zap } from 'lucide-react';
import { toast } from 'react-toastify';

export function LiquidationInterface() {
  const { 
    liquidate,
    slashStakedTokens,
    error,
  } = useLiquidation();

  const [liquidationForm, setLiquidationForm] = useState({
    tokenId: '',
    supplierId: '',
  });
  const [slashForm, setSlashForm] = useState({
    userAddress: '',
  });
  const [isLiquidating, setIsLiquidating] = useState(false);
  const [isSlashing, setIsSlashing] = useState(false);

  const handleLiquidate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!liquidationForm.tokenId || !liquidationForm.supplierId) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      setIsLiquidating(true);
      await liquidate(liquidationForm.tokenId, liquidationForm.supplierId);
      
      // Reset form
      setLiquidationForm({
        tokenId: '',
        supplierId: '',
      });
      
      toast.success('Loan liquidated successfully!');
    } catch (err) {
      console.error('Error liquidating:', err);
      toast.error('Failed to liquidate loan');
    } finally {
      setIsLiquidating(false);
    }
  };

  const handleSlashStakedTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!slashForm.userAddress) {
      toast.error('Please enter user address');
      return;
    }

    try {
      setIsSlashing(true);
      await slashStakedTokens(slashForm.userAddress);
      
      // Reset form
      setSlashForm({
        userAddress: '',
      });
      
      toast.success('Staked tokens slashed successfully!');
    } catch (err) {
      console.error('Error slashing tokens:', err);
      toast.error('Failed to slash staked tokens');
    } finally {
      setIsSlashing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Error: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Warning */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Admin Functions:</strong> These functions are for administrative use only. 
          Use with caution as they can permanently affect user funds and loan status.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Liquidation Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="mr-2 h-5 w-5 text-red-500" />
              Liquidate Defaulted Loan
            </CardTitle>
            <CardDescription>
              Liquidate a defaulted loan by providing the invoice token ID and supplier ID
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLiquidate} className="space-y-4">
              <div>
                <Label htmlFor="tokenId">Invoice Token ID</Label>
                <Input
                  id="tokenId"
                  type="text"
                  value={liquidationForm.tokenId}
                  onChange={(e) => setLiquidationForm({ ...liquidationForm, tokenId: e.target.value })}
                  placeholder="123"
                  required
                />
              </div>
              <div>
                <Label htmlFor="supplierId">Supplier ID</Label>
                <Input
                  id="supplierId"
                  type="text"
                  value={liquidationForm.supplierId}
                  onChange={(e) => setLiquidationForm({ ...liquidationForm, supplierId: e.target.value })}
                  placeholder="456"
                  required
                />
              </div>
              <Button 
                type="submit" 
                disabled={isLiquidating}
                variant="destructive"
                className="w-full"
              >
                {isLiquidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Liquidating...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Liquidate Loan
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Slash Staked Tokens Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5 text-orange-500" />
              Slash Staked Tokens
            </CardTitle>
            <CardDescription>
              Slash staked tokens for a user who has defaulted on their obligations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSlashStakedTokens} className="space-y-4">
              <div>
                <Label htmlFor="userAddress">User Address</Label>
                <Input
                  id="userAddress"
                  type="text"
                  value={slashForm.userAddress}
                  onChange={(e) => setSlashForm({ ...slashForm, userAddress: e.target.value })}
                  placeholder="0x..."
                  required
                />
              </div>
              <Button 
                type="submit" 
                disabled={isSlashing}
                variant="destructive"
                className="w-full"
              >
                {isSlashing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Slashing...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Slash Staked Tokens
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-yellow-800">Liquidation Process</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-yellow-700">
              When a loan is liquidated, the collateral (invoice NFT) is seized and sold to recover the borrowed amount. 
              This process is irreversible and should only be used for genuinely defaulted loans.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-800">Token Slashing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700">
              Slashing staked tokens is a punitive measure for users who default on their obligations. 
              This permanently reduces the user&apos;s staked amount and affects their tier status.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 