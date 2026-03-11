import { useQuery } from '@tanstack/react-query'
import { getAdminDashboard } from '../../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'

const STATUS_COLORS = { open: '#6366f1', submitted: '#f59e0b', verified: '#10b981', rejected: '#ef4444' }

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

export default function AdminDashboard() {
    const { data, isLoading } = useQuery({ queryKey: ['adminDashboard'], queryFn: getAdminDashboard })
    const stats = data?.data?.stats

    if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" /></div>

    const taskStatusData = Object.entries(stats?.tasksByStatus || {}).map(([k, v]) => ({ name: k, value: v }))
    const teamPointsData = (stats?.pointsByTeam || []).map((t) => ({ name: t.teamName || 'Unknown', points: t.totalPoints }))

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="page-title">📊 Admin Dashboard</h1>
                <p className="text-gray-400 text-sm -mt-4">Overview of all teams, tasks, and activity</p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                <StatCard icon="👥" label="Total Users" value={stats?.totalUsers} color="bg-primary-500/20 text-primary-400" />
                <StatCard icon="🏷️" label="Teams" value={stats?.totalTeams} color="bg-pink-500/20 text-pink-400" />
                <StatCard icon="✅" label="Total Tasks" value={stats?.totalTasks} color="bg-amber-500/20 text-amber-400" />
                <StatCard icon="🎪" label="Active Events" value={stats?.totalEvents} color="bg-emerald-500/20 text-emerald-400" />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Task status pie */}
                <div className="card">
                    <h2 className="section-title">Task Status Breakdown</h2>
                    {taskStatusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={taskStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                                    {taskStatusData.map((entry, i) => (
                                        <Cell key={i} fill={STATUS_COLORS[entry.name] || '#6366f1'} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2d3a5a', borderRadius: '8px', color: '#f1f5f9' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <p className="text-gray-500 text-sm">No task data</p>}
                </div>

                {/* Team points bar */}
                <div className="card">
                    <h2 className="section-title">Points by Team</h2>
                    {teamPointsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={teamPointsData}>
                                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2d3a5a', borderRadius: '8px', color: '#f1f5f9' }} />
                                <Bar dataKey="points" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="text-gray-500 text-sm">No points data yet</p>}
                </div>
            </div>

            {/* Top volunteers + Recent announcements */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card">
                    <h2 className="section-title">🏆 Top Members</h2>
                    <div className="space-y-3">
                        {stats?.topVolunteers?.length > 0 ? stats.topVolunteers.map((vol, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-bold text-primary-400">#{i + 1}</span>
                                    <div>
                                        <p className="font-medium text-white">{vol.name}</p>
                                        <p className="text-xs text-gray-400">{vol.email}</p>
                                    </div>
                                </div>
                                <span className="badge-primary text-sm px-3 py-1">{vol.total} pts</span>
                            </div>
                        )) : <p className="text-gray-500 text-sm">No verified points yet</p>}
                    </div>
                </div>

                <div className="card">
                    <h2 className="section-title">📢 Recent Announcements</h2>
                    <div className="space-y-3">
                        {stats?.recentAnnouncements?.length > 0 ? stats.recentAnnouncements.map((ann) => (
                            <div key={ann._id} className="p-3 rounded-lg bg-dark-700 border border-dark-500">
                                <div className="flex items-start gap-2">
                                    {ann.pinned && <span className="text-xs text-amber-400">📌</span>}
                                    <div>
                                        <p className="font-medium text-white text-sm">{ann.title}</p>
                                        <p className="text-xs text-gray-400 mt-1">by {ann.createdBy?.name} · {new Date(ann.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                        )) : <p className="text-gray-500 text-sm">No announcements yet</p>}
                    </div>
                </div>
            </div>
        </div>
    )
}