'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { useActiveAccount, useActiveWallet, useDisconnect, AccountBalance, AccountProvider } from 'thirdweb/react';
import { ConnectButton } from 'thirdweb/react';
import '../globals.css';
import { client } from '../client'
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { avalancheFuji } from 'thirdweb/chains';
import { darkTheme } from 'thirdweb/react';
import { shortenAddress, formatNumber } from 'thirdweb/utils';

function safeShortenAddress(address: string | null, length: number = 4) {
  try {
    if (!address) return 'Anonymous';
    return shortenAddress(address, length);
  } catch {
    return address ?? 'Anonymous';
  }
}

export default function HomePage()
{
    const router = useRouter();
    const wallet = useActiveAccount();
    const userWalletAddress = wallet?.address || null;

    const activeWallet = useActiveWallet();
    const { disconnect } = useDisconnect();
    const formatBalance = (props: any) => `${formatNumber(props.balance, 2)} ${props.symbol.toUpperCase()}`;
    const [accountSubTab, setAccountSubTab] = useState<'assets' | 'activity'>('assets');
    const [activeTab, setActiveTab] = useState<'account' | 'explore'>('account');

    const wallets = [
        inAppWallet({
        auth: {
            options: ["google", "email", "passkey", "phone", "apple", "x"],
        },
        }),
        createWallet("io.metamask"),
        createWallet("walletConnect"),
    ];

    return (
        <div className="flex min-h-screen text-white">

            <div className="fixed top-0 left-0 h-full w-64 bg-white/5 border-r border-white/10 p-5 flex flex-col justify-between z-20">
                <div className="flex flex-col gap-4">
                    <ConnectButton client={client} wallets={wallets} 
                        theme={darkTheme({
                        colors: { primaryButtonBg: "#49c5c5ff", borderColor: '#4e4f50' },
                        })}
                        chain={avalancheFuji} 
                    />
                    <button
                        className={`py-2 px-4 rounded text-left ${
                        activeTab === 'account' ? 'bg-[#49c5c5] text-black' : 'hover:bg-white/10'
                        }`}
                        onClick={() => setActiveTab('account')}
                    >
                        Account
                    </button>
                    <button
                        className={`py-2 px-4 rounded text-left ${
                        activeTab === 'explore' ? 'bg-[#49c5c5] text-black' : 'hover:bg-white/10'
                        }`}
                        onClick={() => setActiveTab('explore')}
                    >
                        Explore
                    </button>
                </div>

                <button
                    onClick={() => {
                        if (activeWallet) disconnect(activeWallet);
                    }}
                    className="mt-10 flex items-center justify-start gap-2 px-4 py-2 rounded hover:bg-white/10 text-white text-sm"
                >
                    <span>⏻</span> Logout
                </button>
            </div>
        </div>
    )
}