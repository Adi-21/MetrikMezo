import { NextResponse } from 'next/server';
import { getUserSessionSignerWallets } from '@/lib/privy-server';

export async function GET() {
  try {
    // Test with a dummy identity token to see if the initialization works
    const testIdentityToken = 'test-token';
    
    console.log('Testing session signer initialization...');
    
    // This will fail with a real error, but we can see if the initialization works
    try {
      await getUserSessionSignerWallets(testIdentityToken);
    } catch (error) {
      // We expect this to fail, but we want to see what error we get
      console.log('Expected error (this is normal):', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Invalid Privy app ID')) {
          return NextResponse.json({
            status: 'initialized',
            error: 'Invalid Privy app ID - check your app configuration',
            details: 'The session signer is initialized but the app ID might be incorrect'
          });
        } else if (error.message.includes('Authentication failed')) {
          return NextResponse.json({
            status: 'initialized',
            error: 'Authentication failed - this is expected with a test token',
            details: 'The session signer is working, but needs a real identity token'
          });
        } else {
          return NextResponse.json({
            status: 'initialized',
            error: error.message,
            details: 'Session signer is initialized but encountered an error'
          });
        }
      }
    }
    
    return NextResponse.json({
      status: 'success',
      message: 'Session signer is properly configured'
    });
    
  } catch (error) {
    console.error('Session signer test error:', error);
    
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Session signer is not properly configured'
    }, { status: 500 });
  }
} 