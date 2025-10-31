'use client';

import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useState, useEffect } from 'react';
import { SupplierLoginButton } from '../components/borrow/SupplierLoginButton';
import { usePrivy } from '@privy-io/react-auth';
import Image from 'next/image';


const roles = [
  {
    id: 'supplier',
    title: 'Invoice Supplier',
    description: 'Upload invoices and get instant financing',
    features: ['Instant liquidity', 'No credit checks', 'Keep customer relationships'],
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'lp',
    title: 'Liquidity Provider',
    description: 'Provide capital and earn competitive returns',
    features: ['12-18% APY', 'Real asset backing', 'Flexible withdrawals'],
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'verifier',
    title: 'Protocol Verifier',
    description: 'Verify invoices and secure the network',
    features: ['Verification rewards', 'Protocol governance', 'Risk management'],
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];

export default function Home() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { authenticated, logout, user, ready } = usePrivy();
  const [selectedRole, setSelectedRole] = useState<'supplier' | 'lp' | 'verifier' | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  const handleRoleSelect = (role: 'supplier' | 'lp' | 'verifier') => {
    setSelectedRole(role);
    setShowWelcome(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedRole', role);
    }
  };

  const handleBackToRoleSelection = () => {
    setSelectedRole(null);
    setShowWelcome(true);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('selectedRole');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setSelectedRole(null);
      setShowWelcome(true);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('selectedRole');
        sessionStorage.clear();
        if (window.ethereum) {
          try {
            await (window.ethereum as any).request({ method: 'wallet_requestPermissions', params: [] });
          } catch {
            // Ignore errors
          }
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('selectedRole');
      if (storedRole) {
        setSelectedRole(storedRole as 'supplier' | 'lp' | 'verifier');
        setShowWelcome(false);
      }
    }
  }, []);

  useEffect(() => {
    if (authenticated && selectedRole === 'supplier' && !isRedirecting) {
      setIsRedirecting(true);
      router.push('/dashboard/supplier');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('selectedRole');
      }
    } else if (authenticated && !selectedRole && !isRedirecting) {
      setSelectedRole('supplier');
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedRole', 'supplier');
      }
    } else if (isConnected && selectedRole && !isRedirecting) {
      if (selectedRole === 'lp') {
        setIsRedirecting(true);
        router.push('/dashboard/lp/deposit');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('selectedRole');
        }
      } else if (selectedRole === 'verifier') {
        setIsRedirecting(true);
        router.push('/dashboard/owner');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('selectedRole');
        }
      }
    }
  }, [authenticated, isConnected, selectedRole, router, isRedirecting]);

  useEffect(() => {
    if (isRedirecting) {
      const timeout = setTimeout(() => {
        setIsRedirecting(false);
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [isRedirecting]);

  const selectedRoleData = roles.find(role => role.id === selectedRole);

  if (!ready) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-[#ff5c00] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-[#ff5c00] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-sm">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with curved bottom */}
      <div className="relative bg-white shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-[#E84142] to-rose-500 opacity-5"></div>
        <div className="relative px-4 py-4 md:px-8 md:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center">
                <span className="font-bold text-xl">
                  <Image className='w-12 h-12 rounded-2xl ' src="/metriklogo.png" alt="Metrik Logo" width={24} height={24} />
                </span>
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Metrik Protocol</h1>
                <p className="text-sm md:text-base text-gray-600">Decentralized Invoice Financing</p>
              </div>
            </div>

            {authenticated && (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500">{user?.email?.address}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Switch Account
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Left Side - Visual Story */}
        <div className={`flex-1 p-4 lg:p-8 order-2 lg:order-1`}>
          <div className="max-w-4xl mx-auto h-full flex items-center">
            {showWelcome ? (
              <div className="w-full">
                {/* Hero Section */}
                <div className="text-center mb-10 md:mb-16">
                  <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-gray-900 mb-4 lg:mb-6 leading-tight">
                    Transform Your Invoices Into
                    <span className="text-[#E84142]"> Instant Liquidity</span>
                  </h1>
                  <p className="text-base sm:text-lg lg:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                    Join the future of decentralized invoice financing. Get paid instantly, earn yield, or secure the network.
                  </p>
                </div>

                {/* Visual Dashboard Mockup */}
                <div className="bg-white rounded-3xl shadow-2xl p-4 md:p-8 border border-gray-100 max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-[#E84142] rounded-2xl flex items-center justify-center">
                        <span className="text-white font-bold">M</span>
                      </div>
                      <div>
                        <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                        <div className="h-3 bg-gray-100 rounded w-24"></div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-[#E84142]/10 to-rose-100 rounded-2xl p-6">
                      <div className="w-10 h-10 bg-[#E84142] rounded-xl mb-4"></div>
                      <div className="h-6 bg-gray-200 rounded mb-2"></div>
                      <div className="h-4 bg-gray-100 rounded w-2/3"></div>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-6">
                      <div className="w-10 h-10 bg-gray-200 rounded-xl mb-4"></div>
                      <div className="h-6 bg-gray-200 rounded mb-2"></div>
                      <div className="h-4 bg-gray-100 rounded w-2/3"></div>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-6">
                      <div className="w-10 h-10 bg-gray-200 rounded-xl mb-4"></div>
                      <div className="h-6 bg-gray-200 rounded mb-2"></div>
                      <div className="h-4 bg-gray-100 rounded w-2/3"></div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="h-5 bg-gray-200 rounded w-32"></div>
                      <div className="w-8 h-8 bg-[#E84142] rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-4/5"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/5"></div>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 md:gap-8 mt-10 md:mt-16 max-w-4xl mx-auto">
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#E84142] mb-1 lg:mb-2">$2.4M+</div>
                    <div className="text-gray-600">Total Volume</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#E84142] mb-1 lg:mb-2">24h</div>
                    <div className="text-gray-600">Avg. Funding</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#E84142] mb-1 lg:mb-2">15.2%</div>
                    <div className="text-gray-600">LP APY</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#E84142] mb-1 lg:mb-2">99.8%</div>
                    <div className="text-gray-600">Success Rate</div>
                  </div>
                </div>
              </div>
            ) : selectedRoleData && (
              <div className="w-full text-center">
                <button
                  onClick={handleBackToRoleSelection}
                  className="hidden lg:inline-flex items-center text-gray-500 hover:text-gray-700 mb-12 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to role selection
                </button>

                <div className="max-w-2xl mx-auto">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 bg-gradient-to-br from-[#E84142] to-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6 lg:mb-8">
                    <img
                      src={`/${selectedRole === 'supplier' ? 'customer' : selectedRole}.png`}
                      alt={selectedRoleData.title}
                      className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 object-contain"
                    />
                  </div>

                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 lg:mb-6 leading-tight">
                    Ready to connect as
                    <br />
                    <span className="text-[#E84142]">{selectedRoleData.title}</span>?
                  </h1>

                  <p className="text-base sm:text-lg lg:text-2xl text-gray-600 mb-8 lg:mb-12 leading-relaxed">
                    {selectedRoleData.description}
                  </p>

                  {/* Large Role Illustration */}
                  <div className="bg-white rounded-3xl shadow-xl p-6 lg:p-12 border border-gray-100">
                    <img
                      src={`/${selectedRole === 'supplier' ? 'customer' : selectedRole}.png`}
                      alt={selectedRoleData.title}
                      className="w-full h-40 sm:h-56 lg:h-64 object-contain rounded-2xl"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Role Selection */}
        <div className={`w-full lg:w-96 bg-white flex-1 lg:border-l border-gray-100 p-4 lg:p-8 order-1 lg:order-2`}>
          <div className="h-full flex flex-col">
            {showWelcome ? (
              <>
                {/* Header */}
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    Choose Your Role
                  </h2>
                  <p className="text-gray-600">
                    Select how you want to participate in the protocol
                  </p>
                </div>

                {/* Role Cards */}
                <div className="flex-1 space-y-4">
                  {roles.map((role, index) => {
                    const roleImage = role.id === 'supplier' ? 'customer' : role.id;
                    return (
                      <button
                        key={role.id}
                        onClick={() => handleRoleSelect(role.id as 'supplier' | 'lp' | 'verifier')}
                        className="w-full group relative overflow-hidden"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="ag-border">
                          <div className="bg-white border-2 border-gray-100 rounded-3xl p-6 transition-all duration-300 group-hover:shadow-lg">
                            <div className="flex items-start space-x-4">
                              {/* Role Image */}
                              <div className="relative flex-shrink-0">
                                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-50 group-hover:scale-110 transition-transform duration-300">
                                  <img
                                    src={`/${roleImage}.png`}
                                    alt={role.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                {/* Selection Indicator */}
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#E84142] rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 text-left">
                                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-[#E84142] transition-colors duration-300">
                                  {role.title}
                                </h3>
                                <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                                  {role.description}
                                </p>

                                {/* Features */}
                                <div className="space-y-1">
                                  {role.features.slice(0, 2).map((feature, idx) => (
                                    <div key={idx} className="flex items-center text-xs text-gray-500">
                                      <div className="w-1 h-1 bg-[#E84142] rounded-full mr-2"></div>
                                      {feature}
                                    </div>
                                  ))}
                                  {role.features.length > 2 && (
                                    <div className="text-xs text-gray-400">
                                      +{role.features.length - 2} more benefits
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Arrow */}
                              <div className="flex-shrink-0 self-center">
                                <div className="w-6 h-6 rounded-full bg-gray-100 group-hover:bg-[#E84142] flex items-center justify-center transition-all duration-300">
                                  <svg className="w-3 h-3 text-gray-400 group-hover:text-white transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Trust Indicators */}
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-4 text-xs text-gray-500 mb-3">
                      <div className="flex items-center space-x-1">
                        <svg className="w-3 h-3 text-[#E84142]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>Secure</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <svg className="w-3 h-3 text-[#E84142]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Fast</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <svg className="w-3 h-3 text-[#E84142]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Trusted</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">Trusted by 1000+ users worldwide</p>
                  </div>
                </div>
              </>
            ) : selectedRoleData && (
              <>
                {/* Mobile back to roles */}
                <div className="mb-4 lg:hidden">
                  <button
                    onClick={handleBackToRoleSelection}
                    className="inline-flex items-center text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to role selection
                  </button>
                </div>
                {/* Connection Header */}
                <div className="mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-[#E84142] to-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <img
                      src={`/${selectedRole === 'supplier' ? 'customer' : selectedRole}.png`}
                      alt={selectedRoleData.title}
                      className="w-12 h-12 object-contain"
                    />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 text-center">
                    Connect Wallet
                  </h2>
                  <p className="text-gray-600 text-center">
                    Connect your wallet to continue as a {selectedRoleData.title.toLowerCase()}
                  </p>
                </div>

                {/* Benefits */}
                <div className="flex-1 mb-8">
                  <div className="bg-gray-50 rounded-3xl p-6 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-4">What you&apos;ll get:</h3>
                    <div className="space-y-3">
                      {selectedRoleData.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center">
                          <div className="w-5 h-5 bg-[#E84142] rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-gray-800 font-medium">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Connect Button */}
                <div className="mb-6">
                  <div className="relative group">
                    {/* Glow Effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-[#E84142] to-rose-500 rounded-3xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>

                    {/* Custom Button */}
                    <button
                      onClick={() => {
                        const hiddenButton = document.querySelector('.hidden-connect-btn button') as HTMLButtonElement;
                        if (hiddenButton) {
                          hiddenButton.click();
                        }
                      }}
                      className="relative w-full py-4 px-6 bg-gradient-to-r from-[#E84142] to-rose-500 hover:from-rose-600 hover:to-rose-700 text-white font-bold text-lg rounded-3xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center space-x-3"
                    >
                      {/* Icon */}
                      <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                        {selectedRole === 'supplier' ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        )}
                      </div>

                      {/* Text */}
                      <span>
                        {selectedRole === 'supplier' && 'Connect & Start Earning'}
                        {selectedRole === 'lp' && 'Connect & Provide Liquidity'}
                        {selectedRole === 'verifier' && 'Connect & Start Verifying'}
                      </span>

                      {/* Arrow */}
                      <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>

                    {/* Hidden original buttons for functionality */}
                    <div className="hidden hidden-connect-btn">
                      {selectedRole === 'supplier' ? (
                        <SupplierLoginButton />
                      ) : (
                        <ConnectButton />
                      )}
                    </div>
                  </div>
                </div>

                {/* Security Info */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <svg className="w-3 h-3 text-[#E84142]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>256-bit SSL</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <svg className="w-3 h-3 text-[#E84142]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Audited Contracts</span>
                    </div>
                  </div>
                </div>

                {/* Manual redirect for stuck authentication */}
                {authenticated && selectedRole === 'supplier' && !isRedirecting && (
                  <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-3xl p-4">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="font-bold text-green-800 mb-2">Ready to go!</h3>
                      <p className="text-sm text-green-600 mb-4">Your wallet is connected</p>
                      <button
                        onClick={() => {
                          setIsRedirecting(true);
                          router.push('/dashboard/supplier');
                        }}
                        className="w-full py-3 bg-[#E84142] text-white rounded-2xl font-semibold hover:bg-rose-600 transition-colors"
                      >
                        Enter Dashboard →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

