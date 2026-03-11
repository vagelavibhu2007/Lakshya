import { useQuery } from '@tanstack/react-query'
import { getMyPoints } from '../../api'

export default function MyPoints() {
    const { data, isLoading } = useQuery({ queryKey: ['my-points'], queryFn: getMyPoints })
    const ledger = data?.data?.ledger || []
    const total = data?.data?.totalPoints || 0

    return (
        <div className="space-y-5 animate-fade-in">
            <h1 className="page-title">⭐ My Points</h1>

            <div className="card border-primary-500/30 bg-gradient-to-br from-primary-500/10 to-pink-500/10">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center text-2xl">⭐</div>
                    <div>
                        <p className="text-gray-400 text-sm">Total Points Earned</p>
                        <p className="text-4xl font-black text-white">{total}</p>
                    </div>
                </div>
            </div>

            <div className="card">
                <h2 className="section-title">Points History</h2>
                {isLoading ? <div className="flex items-center justify-center h-20"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" /></div> : (
                    <div className="space-y-2">
                        {ledger.map((entry) => (
                            <div key={entry._id} className="flex items-center justify-between p-3 rounded-lg bg-dark-700 border border-dark-500">
                                <div>
                                    <p className="text-sm font-medium text-white">{entry.taskId?.title || 'Manual adjustment'}</p>
                                    <p className="text-xs text-gray-400">{entry.type === 'override' ? '⚙️ Admin override' : '✅ Task verified'} · {new Date(entry.createdAt).toLocaleDateString()}</p>
                                    {entry.reason && <p className="text-xs text-gray-500 italic mt-0.5">"{entry.reason}"</p>}
                                </div>
                                <span className={`text-lg font-bold ${entry.points >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {entry.points >= 0 ? '+' : ''}{entry.points}
                                </span>
                            </div>
                        ))}
                        {ledger.length === 0 && <p className="text-gray-500 text-sm text-center py-6">No points earned yet. Complete and get tasks verified to earn points!</p>}
                    </div>
                )}
            </div>
        </div>
    )
}