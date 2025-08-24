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
import { toWei, prepareTransaction, sendTransaction, Insight } from "thirdweb";

interface HelpRequest {
  id: number;
  title: string;
  description: string;
  created_at: string;
  user_wallet: string | null;
}

interface Reply {
  id: number;
  query_id: number;
  parent_id: number | null;
  content: string;
  user_wallet: string | null;
  created_at: string;
  upvotes: number;
}

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

function safeShortenAddress(address: string | null, length: number = 4) {
  try {
    if (!address) return 'Anonymous';
    return shortenAddress(address, length);
  } catch {
    return address ?? 'Anonymous';
  }
}

export default function HomePage() {
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<HelpRequest[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [expandedQueryId, setExpandedQueryId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState<{ [key: string]: string }>({});
  const [replyErrors, setReplyErrors] = useState<{ [key: string]: boolean }>({});
  const [activeReplyTo, setActiveReplyTo] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'account' | 'explore'>('account');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'error' | 'success'>('success');
  const [tipToastMessage, setTipToastMessage] = useState<string | null>(null);
  const [tipToastType, setTipToastType] = useState<'success' | 'error'>('success');

  const router = useRouter();
  const wallet = useActiveAccount();
  const userWalletAddress = wallet?.address || null;

  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const formatBalance = (props: any) => `${formatNumber(props.balance, 2)} ${props.symbol.toUpperCase()}`;
  const [accountSubTab, setAccountSubTab] = useState<'assets' | 'activity'>('assets');
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipRecipient, setTipRecipient] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState('');
  const [sendingTip, setSendingTip] = useState(false);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const isSameAddress = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

  useEffect(() => {
    const fetchTransactions = async () => {
      const txs = await Insight.getTransactions({
        client,
        walletAddress: userWalletAddress!,
        chains: [avalancheFuji],
        queryOptions: {
          limit: 10,
          sort_by: "block_timestamp",
          sort_order: "desc",
        },
      });
      setTransactions(txs);
    };

    if (userWalletAddress && accountSubTab === "activity") {
      fetchTransactions();
    }
  }, [userWalletAddress, accountSubTab]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: queriesData } = await supabase
        .from('queries')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: repliesData } = await supabase
        .from('replies')
        .select('*')
        .order('created_at', { ascending: true });

      setRequests(queriesData || []);
      setFilteredRequests(queriesData || []);
      setReplies(repliesData || []);
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredRequests(requests);
    } else {
      const keywords = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
      const filtered = requests.filter(req =>
        keywords.some(keyword => req.title.toLowerCase().includes(keyword))
      );
      setFilteredRequests(filtered);
    }
  }, [searchTerm, requests]);

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

  const handleExpand = (id: number) => {
    setExpandedQueryId(prev => (prev === id ? null : id));
    setActiveReplyTo(null);
  };

  const handleReply = async (queryId: number, parentId: number | null) => {
    if (!userWalletAddress) {
      setToastMessage('Please connect your wallet.');
      setToastType('error');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    const key = parentId ?? queryId;
    const content = replyContent[key];
    if (!content || !content.trim()) {
      setReplyErrors(prev => ({ ...prev, [key]: true }));
      return;
    }

    const { error } = await supabase.from('replies').insert({
      query_id: queryId,
      parent_id: parentId,
      content,
      user_wallet: userWalletAddress,
      upvotes: 0, // ensure default
    });

    if (!error) {
      setReplyContent(prev => ({ ...prev, [key]: '' }));
      setReplyErrors(prev => ({ ...prev, [key]: false }));

      const { data: updatedReplies } = await supabase
        .from('replies')
        .select('*')
        .order('upvotes', { ascending: false })
        .order('created_at', { ascending: true });

      setReplies(updatedReplies || []);
    }
  };

  const handleUpvote = async (replyId: number) => {
    if (!userWalletAddress) {
      setToastMessage('Please connect your wallet to upvote.');
      setToastType('error');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    // Optimistic UI update
    setReplies(prev =>
      prev.map(r => r.id === replyId ? { ...r, upvotes: r.upvotes + 1 } : r)
    );

    const { error } = await supabase
      .from('replies')
      .update({ upvotes: replies.find(r => r.id === replyId)?.upvotes! + 1 })
      .eq('id', replyId);

    if (error) {
      // Roll back if failed
      setReplies(prev =>
        prev.map(r => r.id === replyId ? { ...r, upvotes: r.upvotes - 1 } : r)
      );
      setToastMessage('Failed to upvote. Try again.');
      setToastType('error');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };


  const renderReplies = (queryId: number, parentId: number | null = null, level = 0) => {
    return replies
      .filter(reply => reply.query_id === queryId && reply.parent_id === parentId)
      .sort(
        (a, b) =>
          b.upvotes - a.upvotes || 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .map(reply => (
        <div
          key={reply.id}
          style={{ marginLeft: level * 24 }} // avoids Tailwind ml-* issue
          className="mt-4 border-l border-white/10 pl-4"
        >
          <p className="text-white">{reply.content}</p>
          <p className="text-xs text-white/50 mt-1">
            {new Date(reply.created_at).toLocaleString()} by{' '}
            <span className="font-mono text-white/70">
              {reply.user_wallet ? shortenAddress(reply.user_wallet, 4) : 'Anonymous'}
            </span>
          </p>

          {/* Upvote button */}
          <button
            className="mr-2 text-xs px-2 py-0.5 rounded-full bg-white/10 hover:bg-cyan-500/20 text-white font-medium items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              handleUpvote(reply.id);
            }}
          >
            ↑ <span>{reply.upvotes}</span>
          </button>

          {/* Tip button */}
          {reply.user_wallet && !isSameAddress(userWalletAddress, reply.user_wallet) && (
            <button
              className="ml-1 text-xs px-3 py-0.5 rounded-full bg-white/10 text-white hover:bg-cyan-500/20"
              onClick={(e) => {
                e.stopPropagation();
                if (!wallet) {
                  setToastMessage('Connect your wallet to tip.');
                  setToastType('error');
                  setTimeout(() => setToastMessage(null), 3000);
                  return;
                }
                setTipRecipient(reply.user_wallet);
                setShowTipModal(true);
              }}
            >
              🔺Cred
            </button>
          )}

          {/* Reply button */}
          <button
            className="mt-2 ml-2 text-sm px-4 py-1 rounded bg-white/10 text-white hover:bg-cyan-500/20 transition"
            onClick={(e) => {
              e.stopPropagation();
              setActiveReplyTo(reply.id);
            }}
          >
            Reply
          </button>

          {activeReplyTo === reply.id && (
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              <textarea
                value={replyContent[reply.id] || ''}
                onChange={e =>
                  setReplyContent(prev => ({ ...prev, [reply.id]: e.target.value }))
                }
                placeholder="Write a reply..."
                className="w-full p-3 bg-black/30 text-white rounded border border-white/10 backdrop-blur-sm"
              />
              {replyErrors[reply.id] && (
                <p className="text-red-400 text-sm mt-1">Message cannot be empty.</p>
              )}
              <button
                onClick={() => handleReply(queryId, reply.id)}
                className="mt-2 px-4 py-1 rounded bg-[#49c5c5] hover:bg-[#44dada] text-black font-medium transition"
              >
                Reply
              </button>
            </div>
          )}
          {renderReplies(queryId, reply.id, level + 1)}
        </div>
      ));
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

  const handleTipSend = async () => {
    if (!userWalletAddress || !wallet || !tipRecipient || !tipAmount) return;

    try {
      setSendingTip(true);

      const transaction = prepareTransaction({
        to: tipRecipient,
        value: toWei(tipAmount),
        chain: avalancheFuji,
        client: client,
      });

      const { transactionHash } = await sendTransaction({
        account: wallet,
        transaction,
      });

      console.log("Transaction successful:", transactionHash);
      setTipToastMessage(`Tip sent! Txn: ${transactionHash.slice(0, 10)}...`);
      setTipToastType('success');
    } catch (err) {
      console.error("Tip failed:", err);
      setTipToastMessage('Failed to send tip.');
      setTipToastType('error');
    } finally {
      setTimeout(() => setTipToastMessage(null), 3500);
      setSendingTip(false);
      setShowTipModal(false);
      setTipAmount('');
      setTipRecipient(null);
    }
  };

  return (
    <div className="flex min-h-screen text-white">

      {/* Sidebar */}
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

      {/* Main Content */}
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

              {/* Assets Content */}
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

              {/* Activity Content */}
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

                              {/* Optional: Show timestamp
                              <div>
                                <strong>Time:</strong>{" "}
                                {new Date(tx.block_timestamp).toLocaleString()}
                              </div> */}

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

            {/* Submit Query Box */}
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

            {/* Search Box */}
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 mb-4">
              <input
                type="text"
                placeholder="Search by keyword (e.g. blockchain, nextjs...)"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-white placeholder-white/50 border-none outline-none focus:outline-none focus:ring-0 caret-white"
              />
            </div>

            {/* Queries List */}
            <div className="rounded-xl border border-white/10 bg-white/5 shadow-lg p-6 overflow-y-auto max-h-[calc(100vh-300px)] custom-scroll">
              {filteredRequests.length > 0 ? (
                filteredRequests.map(req => (
                  <div
                    key={req.id}
                    onClick={() => handleExpand(req.id)}
                    className="rounded-xl border border-white/10 bg-white/5 shadow-md mb-8 transition hover:border-cyan-500/40 cursor-pointer"
                  >
                    <div className="p-5">
                      <h2 className="text-lg sm:text-xl font-semibold text-white hover:no-underline">
                        {req.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-white/60 mt-1">
                        {new Date(req.created_at).toLocaleString()} by{' '}
                        <span className="font-mono text-white/70">
                          {req.user_wallet ? safeShortenAddress(req.user_wallet, 4) : 'Anonymous'}
                          {req.user_wallet && !isSameAddress(userWalletAddress, req.user_wallet) && (
                            <button
                              className="ml-3 text-xs px-3 py-0.5 rounded-full bg-white/10 text-white hover:bg-cyan-500/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!wallet) {
                                  setToastMessage('Connect your wallet to tip.');
                                  setToastType('error');
                                  setTimeout(() => setToastMessage(null), 3000);
                                  return;
                                }
                                setTipRecipient(req.user_wallet);
                                setShowTipModal(true);
                              }}
                            >
                              🔺Cred
                            </button>
                          )}
                        </span>
                      </p>
                      <p className="text-white mt-4 whitespace-pre-line">{req.description}</p>
                    </div>

                    {expandedQueryId === req.id && (
                      <div className="px-5 pb-5 pt-2 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-6">
                          <h3 className="font-semibold text-white mb-3 border-b border-white/10 pb-1">Replies</h3>
                          {renderReplies(req.id)}
                        </div>

                        <div>
                          <textarea
                            value={replyContent[req.id] || ''}
                            onChange={e =>
                              setReplyContent(prev => ({ ...prev, [req.id]: e.target.value }))
                            }
                            placeholder="Write a reply..."
                            className="w-full p-3 bg-black/30 text-white rounded border border-white/10 backdrop-blur-sm min-h-[90px]"
                            onClick={(e) => e.stopPropagation()}
                          />
                          {replyErrors[req.id] && (
                            <p className="text-red-400 text-sm mt-1">Message cannot be empty.</p>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReply(req.id, null);
                            }}
                            className="mt-3 px-5 py-2 rounded bg-[#49c5c5] hover:bg-[#44dada] text-black font-medium transition"
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-white text-center py-8">No queries found matching those keywords.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/*tip box window*/}
      {showTipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white/5 border border-white/10 rounded-2xl shadow-2xl w-[95%] max-w-md p-6 text-white">
            <h2 className="text-xl font-semibold mb-4">Send Tip</h2>

            <p className="text-white/70 text-sm mb-2">
              To: <span className="font-mono">{shortenAddress(tipRecipient || '', 6)}</span>
            </p>

            <input
              type="number"
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
              placeholder="Amount (AVAX)"
              className="w-full p-3 rounded-lg bg-transparent border border-white/10 text-white placeholder-white/50 mb-4"
              min="0"
            />

            <div className="flex justify-end gap-4 pt-1">
              <button
                onClick={() => {
                  setShowTipModal(false);
                  setTipAmount('');
                  setTipRecipient(null);
                }}
                className="text-white text-sm hover:underline"
              >
                Cancel
              </button>

              <button
                onClick={handleTipSend}
                disabled={sendingTip || !tipAmount}
                className="bg-[#49c5c5] text-black px-5 py-2 rounded-lg hover:bg-[#44dada] transition disabled:opacity-50"
              >
                {sendingTip ? 'Sending...' : 'Send Tip'}
              </button>
            </div>
          </div>
        </div>
      )}
      {tipToastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm border backdrop-blur-md transition-all duration-300 ${
            tipToastType === 'success'
              ? 'bg-green-400/90 text-black border-green-500'
              : 'bg-red-400/90 text-black border-red-500'
          }`}
        >
          {tipToastMessage}
        </div>
      )}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm border backdrop-blur-md transition-all duration-300 ${
            toastType === 'success'
              ? 'bg-green-400/90 text-black border-green-500'
              : 'bg-red-400/90 text-black border-red-500'
          }`}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
