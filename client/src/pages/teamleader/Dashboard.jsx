import { useQuery } from '@tanstack/react-query'
import { getTLDashboard } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

function StatCard({ icon, label, value, color }) {
    return (
        <div className="stat-card">
            <div className={`stat-icon ${color}`}>{icon}</div>
            <div><p className="text-gray-400 text-sm">{label}</p><p className="text-2xl font-bold text-white">{value ?? '—'}</p></div>
        </div>
    )
}

export default function TLDashboard() {
    const { user } = useAuth()
    const { data, isLoading } = useQuery({ queryKey: ['tlDashboard'], queryFn: getTLDashboard })
    const stats = data?.data?.stats

    if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" /></div>

    const taskData = Object.entries(stats?.tasksByStatus || {}).map(([k, v]) => ({ name: k, count: v }))

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="page-title">📊 Team Dashboard</h1>
                <p className="text-gray-400 text-sm -mt-4">{stats?.team?.name} — Welcome, {user?.name}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                <StatCard icon="👥" label="Members" value={stats?.members?.length} color="bg-primary-500/20 text-primary-400" />
                <StatCard icon="✅" label="Open Tasks" value={stats?.tasksByStatus?.open} color="bg-amber-500/20 text-amber-400" />
                <StatCard icon="⏳" label="Submitted" value={stats?.tasksByStatus?.submitted} color="bg-blue-500/20 text-blue-400" />
                <StatCard icon="🏆" label="Verified" value={stats?.tasksByStatus?.verified} color="bg-emerald-500/20 text-emerald-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card">
                    <h2 className="section-title">Task Status</h2>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={taskData}>
                            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2d3a5a', borderRadius: '8px', color: '#f1f5f9' }} />
                            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="card">
                    <h2 className="section-title">🏆 Top Members</h2>
                    <div className="space-y-2">
                        {stats?.topMembers?.length > 0 ? stats.topMembers.map((m, i) => (
                            <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-dark-700">
                                <div className="flex items-center gap-2">
                                    <span className="text-primary-400 font-bold text-sm">#{i + 1}</span>
                                    <span className="text-white text-sm font-medium">{m.name}</span>
                                </div>
                                <span className="badge-primary">{m.total} pts</span>
                            </div>
                        )) : <p className="text-gray-500 text-sm">No points earned yet</p>}
                    </div>
                </div>
            </div>

            <div className="card">
                <h2 className="section-title">⏰ Pending Submissions</h2>
                <div className="space-y-2">
                    {stats?.recentSubmissions?.length > 0 ? stats.recentSubmissions.map((s) => (
                        <div key={s._id} className="flex items-center justify-between p-3 rounded-lg bg-dark-700 border border-dark-500">
                            <div>
                                <p className="text-sm font-medium text-white">{s.taskId?.title}</p>
                                <p className="text-xs text-gray-400">{s.submittedBy?.name} · {s.proofType}</p>
                            </div>
                            <span className="badge-warning">Pending</span>
                        </div>
                    )) : <p className="text-gray-500 text-sm">No pending submissions</p>}
                </div>
            </div>
        </div>
    )
}