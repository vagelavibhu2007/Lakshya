import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCAProfile, getCAReferrals, applyReferralCode, getCAPoints } from '../../api'
import { useAuth } from '../../context/AuthContext'

function ReferralCard({ referral }) {
    const getStatusColor = (status) => {
        switch (status) {
            case 'confirmed': return 'text-green-400 bg-green-400/10'
            case 'pending': return 'text-yellow-400 bg-yellow-400/10'
            case 'rejected': return 'text-red-400 bg-red-400/10'
            case 'expired': return 'text-gray-400 bg-gray-400/10'
            default: return 'text-gray-400 bg-gray-400/10'
        }
    }

    return (
        <div className="card p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
                        <span className="text-primary-400 font-semibold">
                            {referral.referredUser?.name?.charAt(0) || '?'}
                        </span>
                    </div>
                    <div>
                        <div className="font-semibold text-white">
                            {referral.referredUser?.name || 'Unknown User'}
                        </div>
                        <div className="text-sm text-gray-400">
                            {referral.referredUser?.email || 'No email'}
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(referral.status)}`}>
                        {referral.status}
                    </span>
                    <div className="text-xs text-gray-400 mt-1">
                        {new Date(referral.createdAt).toLocaleDateString()}
                    </div>
                </div>
            </div>
            {referral.rewardPoints > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Reward Points</span>
                        <span className="text-amber-400 font-semibold">+{referral.rewardPoints}</span>
                    </div>
                </div>
            )}
        </div>
    )
}

function ApplyReferralCode() {
    const [code, setCode] = useState('')
    const [message, setMessage] = useState('')
    const queryClient = useQueryClient()

    const applyMutation = useMutation({
        mutationFn: applyReferralCode,
        onSuccess: (data) => {
            setMessage('✅ Referral code applied successfully!')
            setCode('')
            queryClient.invalidateQueries(['myReferral'])
        },
        onError: (error) => {
            setMessage(error.response?.data?.message || '❌ Failed to apply referral code')
        }
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!code.trim()) return
        applyMutation.mutate({ referralCode: code.trim() })
    }

    return (
        <div className="card">
            <h3 className="section-title">Apply Referral Code</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="Enter referral code"
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        maxLength={10}
                    />
                </div>
                <button
                    type="submit"
                    disabled={applyMutation.isPending}
                    className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                    {applyMutation.isPending ? 'Applying...' : 'Apply Code'}
                </button>
                {message && (
                    <div className={`text-sm ${message.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
                        {message}
                    </div>
                )}
            </form>
        </div>
    )
}

export default function Referrals() {
    const { user } = useAuth()
    const [page, setPage] = useState(1)
    const [status, setStatus] = useState('')

    const { data: caData, isLoading: caLoading, isError: caIsError, error: caError } = useQuery({
        queryKey: ['caProfile'],
        queryFn: getCAProfile,
        enabled: user?.role === 'campus_ambassador'
    })

    const isMarketingCA = caData?.data?.user?.isMarketingCA

    const { data, isLoading } = useQuery({
        queryKey: ['caReferrals', page, status],
        queryFn: () => getCAReferrals({ page, limit: 10, status }),
        enabled: user?.role === 'campus_ambassador' && isMarketingCA
    })

    const referrals = data?.data?.referrals || []
    const pagination = data?.data?.pagination || {}

    if (user?.role !== 'campus_ambassador') {
        return (
            <div className="text-center py-12">
                <div className="text-4xl mb-4">🚫</div>
                <h2 className="text-xl font-semibold text-white mb-2">Access Restricted</h2>
                <p className="text-gray-400">This page is only available for Campus Ambassadors</p>
            </div>
        )
    }

    if (caLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
            </div>
        )
    }

    if (caIsError) {
        return (
            <div className="text-center py-12">
                <div className="text-4xl mb-4">⚠️</div>
                <h2 className="text-xl font-semibold text-white mb-2">Unable to load CA profile</h2>
                <p className="text-gray-400">{caError?.response?.data?.message || caError?.message || 'Please try again.'}</p>
            </div>
        )
    }

    if (!isMarketingCA) {
        return (
            <div className="text-center py-12">
                <div className="text-4xl mb-4">ℹ️</div>
                <h2 className="text-xl font-semibold text-white mb-2">Referral System - Marketing Team Only</h2>
                <p className="text-gray-400">Referral tracking is only available for Campus Ambassadors in the Marketing team.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="page-title">👥 My Referrals</h1>
                <p className="text-gray-400 text-sm -mt-4">Track your referral network and event points</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Filters */}
                    <div className="card">
                        <div className="flex flex-wrap gap-2">
                            {['', 'pending', 'confirmed', 'rejected', 'expired'].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => {
                                        setStatus(s)
                                        setPage(1)
                                    }}
                                    className={`px-3 py-1 rounded-full text-sm font-semibold transition ${status === s
                                            ? 'bg-primary-500 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    {s || 'All'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Referrals List */}
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" />
                        </div>
                    ) : referrals.length > 0 ? (
                        <div className="space-y-3">
                            {referrals.map((referral) => (
                                <ReferralCard key={referral._id} referral={referral} />
                            ))}

                            {/* Pagination */}
                            {pagination.pages > 1 && (
                                <div className="flex justify-center space-x-2 pt-4">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-3 py-1 text-gray-300">
                                        Page {page} of {pagination.pages}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                        disabled={page === pagination.pages}
                                        className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="card text-center py-8">
                            <div className="text-4xl mb-4">📭</div>
                            <h3 className="text-lg font-semibold text-white mb-2">No referrals yet</h3>
                            <p className="text-gray-400">Start sharing your referral code to build your network!</p>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <ApplyReferralCode />

                    {/* Event Points Summary */}
                    <EventPointsPanel />

                    {/* Stats Summary */}
                    <div className="card">
                        <h3 className="section-title">Summary</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Total Referrals</span>
                                <span className="font-semibold">{pagination.total || 0}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">This Page</span>
                                <span className="font-semibold">{referrals.length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// -- Sub-component: shows event-referral points panel for CAs --
function EventPointsPanel() {
    const { data, isLoading } = useQuery({
        queryKey: ['caPoints'],
        queryFn: () => getCAPoints({ limit: 10 }),
    })
    const totalPoints = data?.data?.totalPoints ?? 0
    const ledger = data?.data?.ledger || []

    return (
        <div className="card border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-amber-500/5">
            <div className="flex items-center justify-between mb-3">
                <h3 className="section-title mb-0">⭐ Event Points</h3>
                <span className="text-2xl font-black text-yellow-400">{totalPoints} pts</span>
            </div>
            <p className="text-xs text-gray-400 mb-4">Earned when participants register using your referral code</p>

            {isLoading ? (
                <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-t-2 border-yellow-400" /></div>
            ) : ledger.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-3">No event points yet. Share your referral code at events!</p>
            ) : (
                <div className="space-y-2">
                    {ledger.map(entry => (
                        <div key={entry._id} className="flex items-center justify-between p-2.5 rounded-lg bg-dark-700 border border-dark-500">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                    {entry.event?.name || 'Event'}
                                    {entry.event?.isFlagship && <span className="ml-1.5 text-xs bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded-full">⭐ Flagship</span>}
                                </p>
                                <p className="text-xs text-gray-400">{entry.event?.date ? new Date(entry.event.date).toLocaleDateString() : new Date(entry.createdAt).toLocaleDateString()}</p>
                            </div>
                            <span className="text-emerald-400 font-bold text-sm ml-2">+{entry.points}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}