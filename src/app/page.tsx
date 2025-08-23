'use client';

import { darkTheme, useActiveAccount } from 'thirdweb/react';
import { ConnectEmbed } from 'thirdweb/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { client } from './client';
import { avalancheFuji, avalanche } from 'thirdweb/chains';
import { inAppWallet, createWallet } from 'thirdweb/wallets';

export default function LoginPage() {
  const account = useActiveAccount();
  const router = useRouter();

  const wallets = [
    inAppWallet({
      auth: {
        options: ['google', 'email', 'passkey', 'phone', 'apple', 'x'],
      },
    }),
    createWallet('io.metamask'),
    createWallet('walletConnect'),
  ];

  useEffect(() => {
    if (account) {
      router.push('/home');
    }
  }, [account, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <img src="/logo.png" alt="DeStack Logo" className="w-48 mb-4" />

      <p className="text-white/80 text-lg mb-8 text-center">
        Decentralized Peer-to-Peer Network
      </p>
      
      <ConnectEmbed
        client={client}
        wallets={wallets}
        chain={avalancheFuji}
        theme={darkTheme({
          colors: {
            borderColor: '#4e4f50',
          },
        })}
      />

      <button
        onClick={() => router.push('/home')}
        className="absolute bottom-6 right-6 bg-black/60 text-white px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-sm md:text-base shadow-md backdrop-blur-sm"
      >
        Skip →
      </button>
    </div>
  );
}
