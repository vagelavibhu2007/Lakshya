import { useQuery } from '@tanstack/react-query'
import { getCAProfile, getMyPoints } from '../../api'
import { useAuth } from '../../context/AuthContext'

function StatCard({ icon, label, value, color }) {
    return (
        <div className="stat-card">
            <div className={`stat-icon ${color}`}>{icon}</div>
            <div>
                <p className="text-gray-400 text-sm">{label}</p>
                <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
            </div>
        </div>
    )
}

function ReferralCodeCard({ referralInfo }) {
    const copyToClipboard = () => {
        navigator.clipboard.writeText(referralInfo.code)
        // You could add a toast notification here
    }

    return (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-4">Your Referral Code</h2>
            <div className="bg-white/20 backdrop-blur rounded-lg p-4 mb-4">
                <div className="text-2xl font-mono text-center mb-2">
                    {referralInfo.code}
                </div>
                <button
                    onClick={copyToClipboard}
                    className="w-full bg-white text-blue-600 px-4 py-2 rounded font-semibold hover:bg-blue-50 transition"
                >
                    Copy Code
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                <div className="text-center">
                    <div className="text-xl font-bold">{referralInfo.totalReferrals}</div>
                    <div className="text-xs opacity-90">Total</div>
                </div>
                <div className="text-center">
                    <div className="text-xl font-bold">{referralInfo.confirmedReferrals}</div>
                    <div className="text-xs opacity-90">Confirmed</div>
                </div>
                <div className="text-center">
                    <div className="text-xl font-bold">{referralInfo.conversionRate}%</div>
                    <div className="text-xs opacity-90">Rate</div>
                </div>
            </div>
        </div>
    )
}

export default function VolDashboard() {
    const { user } = useAuth()
    const isCA = user?.role === 'campus_ambassador'

    const { data: caData, isLoading: caLoading } = useQuery({
        queryKey: ['caProfile'],
        queryFn: getCAProfile,
        enabled: isCA
    })

    const { data: pointsData, isLoading: pointsLoading } = useQuery({
        queryKey: ['myPoints'],
        queryFn: getMyPoints
    })

    if (caLoading || pointsLoading) {
        return <div className="flex items-center justify-center h-64">
            <div className="animate-spin xyz rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
        </div>
    }
    // sample code here
    // sample code here
    const points = pointsData?.data
    const referralInfo = caData?.data?.user?.referralInfo
    const isMarketingCA = caData?.data?.user?.isMarketingCA

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="page-title">
                    {user?.role === 'campus_ambassador' ? '🌟 Campus Ambassador Dashboard' : '👋 Member Dashboard'}
                </h1>
                <p className="text-gray-400 text-sm -mt-4">
                    {user?.role === 'campus_ambassador'
                        ? (isMarketingCA ? 'Manage your referrals and track your impact' : 'Campus Ambassador Portal')
                        : 'View your tasks and progress'
                    }
                </p>
            </div>

            {/* Referral Code Section - Only for Marketing CAs */}
            {isMarketingCA && referralInfo && (
                <ReferralCodeCard referralInfo={referralInfo} />
            )}

            {/* Non-Marketing CA Notice */}
            {user?.role === 'campus_ambassador' && !isMarketingCA && (
                <div className="card bg-blue-500/10 border border-blue-500/30">
                    <div className="flex items-center space-x-3">
                        <div className="text-2xl">ℹ️</div>
                        <div>
                            <h3 className="text-white font-semibold">Referral System</h3>
                            <p className="text-gray-300 text-sm">Referral codes are only available for Campus Ambassadors in the Marketing team.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon="⭐"
                    label="My Points"
                    value={points?.totalPoints}
                    color="bg-amber-500/20 text-amber-400"
                />
                <StatCard
                    icon="✅"
                    label="Tasks Completed"
                    value={points?.tasksCompleted}
                    color="bg-emerald-500/20 text-emerald-400"
                />
                {isMarketingCA && (
                    <StatCard
                        icon="🎟️"
                        label="Event Points"
                        value={referralInfo?.totalPoints ?? 0}
                        color="bg-yellow-500/20 text-yellow-400"
                    />
                )}
                <StatCard
                    icon="🏆"
                    label="Rank"
                    value={`#${points?.leaderboardRank || '—'}`}
                    color="bg-purple-500/20 text-purple-400"
                />
            </div>

            {/* Quick Actions */}
            {/* <div className="card">
                <h2 className="section-title">Quick Actions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <a 
                        href="/vol/tasks" 
                        className="p-4 bg-primary-500/10 hover:bg-primary-500/20 rounded-lg text-center transition hover:scale-105"
                    >
                        <div className="text-2xl mb-2">✅</div>
                        <div className="font-semibold">View Tasks</div>
                        <div className="text-sm text-gray-400">See assigned tasks</div>
                    </a>
                    <a 
                        href="/vol/submit" 
                        className="p-4 bg-green-500/10 hover:bg-green-500/20 rounded-lg text-center transition hover:scale-105"
                    >
                        <div className="text-2xl mb-2">📤</div>
                        <div className="font-semibold">Submit Proof</div>
                        <div className="text-sm text-gray-400">Upload task evidence</div>
                    </a>
                    <a 
                        href="/vol/points" 
                        className="p-4 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg text-center transition hover:scale-105"
                    >
                        <div className="text-2xl mb-2">⭐</div>
                        <div className="font-semibold">My Points</div>
                        <div className="text-sm text-gray-400">View point history</div>
                    </a>

                    <a 
                        href="/vol/announcements" 
                        className="p-4 bg-pink-500/10 hover:bg-pink-500/20 rounded-lg text-center transition hover:scale-105"
                    >
                        <div className="text-2xl mb-2">📢</div>
                        <div className="font-semibold">Announcements</div>
                        <div className="text-sm text-gray-400">Latest updates</div>
                    </a>
                    <a 
                        href="/vol/leaderboard" 
                        className="p-4 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg text-center transition hover:scale-105"
                    >
                        <div className="text-2xl mb-2">🏆</div>
                        <div className="font-semibold">Leaderboard</div>
                        <div className="text-sm text-gray-400">View rankings</div>
                    </a>
                </div>
            </div> */}
        </div>
    )
}