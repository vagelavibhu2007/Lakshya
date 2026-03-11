import { useQuery } from '@tanstack/react-query'
import { getFacultyDashboard } from '../../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444']

export default function FacultyDashboard() {
    const { data, isLoading } = useQuery({ queryKey: ['facultyDashboard'], queryFn: getFacultyDashboard })
    const stats = data?.data?.stats

    if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" /></div>

    const teamPoints = stats?.pointsByTeam || []
    const teamsData = teamPoints.map((t) => ({ name: t.teamName || 'Unknown', points: t.totalPoints }))

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="page-title">📊 Faculty Overview</h1>
                {/* <p className="text-gray-400 text-sm -mt-4">Global read-only view of all team performance</p> */}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card">
                    <h2 className="section-title">Points by Team</h2>
                    {teamsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={teamsData}>
                                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2d3a5a', borderRadius: '8px', color: '#f1f5f9' }} />
                                <Bar dataKey="points" radius={[4, 4, 0, 0]}>
                                    {teamsData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="text-gray-500 text-sm">No points data</p>}
                </div>

                <div className="card">
                    <h2 className="section-title">Teams & Leaders</h2>
                    <div className="space-y-2">
                        {(stats?.teams || []).map((t, i) => (
                            <div key={t._id} className="flex items-center gap-3 p-2.5 rounded-lg bg-dark-700">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: COLORS[i % COLORS.length] }}>{t.name[0]}</div>
                                <div>
                                    <p className="text-sm font-medium text-white">{t.name}</p>
                                    <p className="text-xs text-gray-400">Leader: {t.leaderId?.name || 'Unassigned'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="card">
                <h2 className="section-title">🎪 Upcoming Events</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(stats?.upcomingEvents || []).map((ev) => (
                        <div key={ev._id} className="p-3 rounded-lg bg-dark-700 border border-dark-500">
                            <p className="font-medium text-white">{ev.name}</p>
                            <p className="text-xs text-gray-400">📅 {new Date(ev.date).toLocaleString()} · 📍 {ev.venue || 'TBD'}</p>
                        </div>
                    ))}
                    {!stats?.upcomingEvents?.length && <p className="text-gray-500 text-sm">No upcoming events</p>}
                </div>
            </div>
        </div>
    )
}