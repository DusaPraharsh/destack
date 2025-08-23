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

type WalletTransaction = {
  chain_id: string;
  block_number: number;
  block_hash: string;
  block_timestamp: number;
  hash: string;
  nonce: number;
  transaction_index: number;
  from_address: string;
  to_address: string;
  value: string;
  gas: number;
  gas_price: string;
  decoded?: {
    name: string;
    signature: string;
    inputs?: object;
  };
};

interface HelpRequest {
  id: number;
  title: string;
  description: string;
  created_at: string;
  user_wallet: string | null;
}

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
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [formOpen, setFormOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [requests, setRequests] = useState<HelpRequest[]>([]);
    const [filteredRequests, setFilteredRequests] = useState<HelpRequest[]>([]);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastType, setToastType] = useState<'error' | 'success'>('success');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!userWalletAddress) {
        setToastMessage('Please connect your wallet.');
        setToastType('error');
        setTimeout(() => setToastMessage(null), 3000);
        return;
        }

        const { error } = await supabase.from('queries').insert([
        {
            title,
            description,
            tags,
            created_at: new Date().toISOString(),
            user_wallet: userWalletAddress,
            status: 'open',
        },
        ]);

        if (error) {
        setToastMessage('Failed to submit request.');
        setToastType('error');
        setTimeout(() => setToastMessage(null), 3000);
        return;
        }

        setTitle('');
        setDescription('');
        setTags('');
        setFormOpen(false);

        const { data: updatedQueries } = await supabase
        .from('queries')
        .select('*')
        .order('created_at', { ascending: false });

        setRequests(updatedQueries || []);
        setFilteredRequests(updatedQueries || []);

        setToastMessage('Request submitted successfully!');
        setToastType('success');
        setTimeout(() => setToastMessage(null), 3000);
    };

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

            <div className="ml-64 flex-1 px-4 sm:px-6 lg:px-8 space-y-10">
                {activeTab === 'account' && (
                    <div className="pt-10">
                        <h2 className="text-2xl font-semibold mb-4">Account</h2>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                        <p>Total Value:</p>

                        {userWalletAddress ? (
                            <AccountProvider address={userWalletAddress} client={client}>
                            <span className="font-mono text-lg text-green-400">
                                <AccountBalance 
                                chain={avalancheFuji} 
                                showBalanceInFiat="USD"
                                fallbackComponent={<span>$0.00</span>}
                                loadingComponent={<span className="text-white/40">Loading...</span>}
                                />
                            </span>
                            </AccountProvider>
                        ) : (
                            <p className="text-white/40 mt-1">Not connected</p>
                        )}

                        <p className="mt-4">Connected wallet:</p>
                        <p className="font-mono mt-2 text-lg text-cyan-400">
                            {userWalletAddress ? shortenAddress(userWalletAddress, 10) : 'Not connected'}
                        </p>
                        </div>
                        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6">
                        <div className="flex space-x-4 mb-4">
                            <button
                            onClick={() => setAccountSubTab('assets')}
                            className={`px-4 py-2 rounded ${
                                accountSubTab === 'assets' ? 'bg-[#49c5c5] text-black' : 'bg-white/10 text-white'
                            }`}
                            >
                            Assets
                            </button>
                            <button
                            onClick={() => setAccountSubTab('activity')}
                            className={`px-4 py-2 rounded ${
                                accountSubTab === 'activity' ? 'bg-[#49c5c5] text-black' : 'bg-white/10 text-white'
                            }`}
                            >
                            Activity
                            </button>
                        </div>

                        {accountSubTab === 'assets' && (
                            <div>
                            {userWalletAddress ? (
                                <AccountProvider address={userWalletAddress} client={client}>
                                <div className="text-white/90">
                                    <div className="grid grid-cols-3 text-sm font-semibold border-b border-white/10 pb-2 mb-2 text-white/70">
                                    <span>Asset</span>
                                    <span className="text-center">Value</span>
                                    <span className="text-right">Balance</span>
                                    </div>

                                    <div className="grid grid-cols-3 text-sm py-2 border-b border-white/5">
                                    <span className="text-white font-mono">AVAX</span>

                                    <span className="text-center text-green-400 font-mono">
                                        <AccountBalance
                                        chain={avalancheFuji}
                                        showBalanceInFiat="USD"
                                        loadingComponent={<span className="text-white/40">Loading...</span>}
                                        fallbackComponent={<span className="text-red-400">$0.00</span>}
                                        />
                                    </span>
                                    <span className="text-right text-cyan-400 font-mono">
                                        <AccountBalance
                                        chain={avalancheFuji}
                                        formatFn={({ balance }) => `${formatNumber(balance, 4)}`}
                                        loadingComponent={<span className="text-white/40">--</span>}
                                        fallbackComponent={<span className="text-red-400">0.00</span>}
                                        />
                                    </span>
                                    </div>
                                </div>
                                </AccountProvider>
                            ) : (
                                <p className="text-white/40">Not connected</p>
                            )}
                            </div>
                        )}

                        {accountSubTab === 'activity' && (
                            <div className="mt-6">
                            <h3 className="text-white text-lg font-semibold mb-4">Recent Wallet Activity</h3>

                            {!userWalletAddress ? (
                                <p className="text-white/40">Not connected</p>
                            ) : transactions.length === 0 ? (
                                <p className="text-white/40">No transactions found.</p>
                            ) : (
                                <div className="space-y-4 max-h-[700px] overflow-y-auto custom-scroll pr-1">
                                {[...transactions]
                                    .sort(
                                    (a, b) =>
                                        new Date(b.block_timestamp).getTime() -
                                        new Date(a.block_timestamp).getTime()
                                    )
                                    .map((tx) => {
                                    const isSent =
                                        tx.from_address.toLowerCase() === userWalletAddress.toLowerCase();
                                    const directionColor = isSent ? "text-red-400" : "text-green-400";
                                    const prefix = isSent ? "-" : "+";

                                    return (
                                        <div
                                        key={tx.hash}
                                        className="border border-white/10 rounded-lg p-4 bg-white/5 text-white text-sm"
                                        >
                                        <div>
                                            <strong>Hash:</strong> {tx.hash.slice(0, 12)}...
                                        </div>

                                        <div>
                                            <strong>From:</strong>{" "}
                                            <span title={tx.from_address}>
                                            {tx.from_address.slice(0, 6)}...
                                            {tx.from_address.slice(-4)}
                                            </span>
                                        </div>

                                        <div>
                                            <strong>To:</strong>{" "}
                                            <span title={tx.to_address || ""}>
                                            {tx.to_address
                                                ? `${tx.to_address.slice(0, 6)}...${tx.to_address.slice(-4)}`
                                                : "Contract Call"}
                                            </span>
                                        </div>

                                        <div>
                                            <strong>Value:</strong>{" "}
                                            <span className={`${directionColor}`}>
                                            {prefix}
                                            {(parseFloat(tx.value) / 1e18).toFixed(4)} AVAX
                                            </span>
                                        </div>

                                        <a
                                            href={`https://testnet.snowtrace.io/tx/${tx.hash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-cyan-400 underline text-xs mt-1 inline-block"
                                        >
                                            View on Snowtrace ↗
                                        </a>
                                        </div>
                                    );
                                    })}
                                </div>
                            )}
                            </div>
                        )}
                        </div>
                    </div>
                )}
                {activeTab === 'explore' && (
                    <>
                        {!wallet && (
                        <div className="mt-6 bg-yellow-500/10 text-yellow-300 text-sm px-4 py-2 rounded mb-4 border border-yellow-300/30">
                            You’re viewing in guest mode. Connect your wallet to post or reply.
                        </div>
                        )}

                        <h2 className="text-2xl font-semibold mb-4 mt-10">Explore</h2>

                        <div>
                            {!formOpen && (
                                <input
                                type="text"
                                placeholder="What's on your mind?"
                                className="w-full px-4 py-3 rounded-lg bg-white/10 text-white placeholder-white/50"
                                onFocus={() => setFormOpen(true)}
                                />
                            )}

                            {formOpen && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                                <div className="bg-white/5 border border-white/10 rounded-2xl shadow-2xl w-[95%] max-w-2xl p-8 text-white">
                                    <form onSubmit={handleSubmit} className="space-y-5">
                                    <h2 className="text-xl font-semibold">Submit Query</h2>

                                    <input
                                        type="text"
                                        placeholder="Title"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full p-4 rounded-lg bg-transparent border border-white/10 text-white placeholder-white/40"
                                        required
                                    />

                                    <textarea
                                        placeholder="Description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full p-4 rounded-lg bg-transparent border border-white/10 text-white placeholder-white/40 h-40 custom-scroll overflow-y-auto"
                                        required
                                    />

                                    <label className="block">
                                        <div className="relative bg-white/10 rounded-lg">
                                        <select
                                            value={tags}
                                            onChange={(e) => setTags(e.target.value)}
                                            required
                                            className="w-full p-3 bg-transparent text-white border border-white/10 rounded-lg appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                                        >
                                            <option value="" disabled hidden>Select a tag</option>
                                            <option className="bg-[#121212] text-white" value="discussion">Discussion</option>
                                            <option className="bg-[#121212] text-white" value="dev-help">Coding</option>
                                            <option className="bg-[#121212] text-white" value="feedback">Feedback</option>
                                        </select>

                                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white">
                                            ▼
                                        </div>
                                        </div>
                                    </label>

                                    <div className="flex justify-between items-center pt-2">
                                        <button
                                        type="submit"
                                        className="bg-[#49c5c5] text-black py-2 px-6 rounded-lg hover:bg-[#44dada] transition"
                                        >
                                        Submit
                                        </button>
                                        <button
                                        type="button"
                                        onClick={() => setFormOpen(false)}
                                        className="text-white text-sm hover:underline"
                                        >
                                        Cancel
                                        </button>
                                    </div>
                                    </form>
                                </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}