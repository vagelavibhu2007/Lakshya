import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getLeaderboard, getTeams } from '../api'

const ROLE_LABEL = { member: 'Member', campus_ambassador: 'CA' }
const RANK_STYLE = ['text-yellow-400 text-xl', 'text-gray-300 text-lg', 'text-amber-600 text-lg']
const RANK_ICON = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
    const [teamFilter, setTeamFilter] = useState('')
    const [roleFilter, setRoleFilter] = useState('')

    const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: getTeams })
    const teams = teamsData?.data?.teams || []

    const { data, isLoading } = useQuery({
        queryKey: ['leaderboard', teamFilter, roleFilter],
        queryFn: () => getLeaderboard({ teamId: teamFilter, role: roleFilter }),
        refetchInterval: 30000, // auto-refresh every 30s
    })
    const leaderboard = data?.data?.leaderboard || []

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="page-title mb-0 text-xl sm:text-2xl">🏆 Leaderboard</h1>
                <span className="text-xs text-gray-500">Auto-refreshes every 30s</span>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <select className="input w-full sm:w-44" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
                    <option value="">All Teams</option>
                    {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
                <select className="input w-full sm:w-44" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                    <option value="">All Roles</option>
                    <option value="member">Members</option>
                    <option value="campus_ambassador">Campus Ambassadors</option>
                </select>
            </div>

            {/* Top 3 podium */}
            {!isLoading && leaderboard.length >= 3 && (
                <div className="flex flex-col sm:flex-row items-center sm:items-end justify-center gap-6 sm:gap-4 pt-4 pb-2">
                    {/* 2nd */}
                    <div className="text-center flex flex-col items-center gap-2">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
                            {leaderboard[1].name?.[0]}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">{leaderboard[1].name}</p>
                            <p className="text-xs text-gray-400">{leaderboard[1].teamName}</p>
                            <p className="text-gray-300 font-extrabold">{leaderboard[1].totalPoints} pts</p>
                        </div>
                        <div className="w-16 h-16 rounded-t-xl bg-gray-500/30 border border-gray-500/50 flex items-end justify-center pb-2 text-2xl">🥈</div>
                    </div>
                    {/* 1st */}
                    <div className="text-center flex flex-col items-center gap-2 -mt-4">
                        <div className="w-18 h-18 w-[72px] h-[72px] rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-yellow-500/30 ring-2 ring-yellow-400">
                            {leaderboard[0].name?.[0]}
                        </div>
                        <div>
                            <p className="text-base font-bold text-white">{leaderboard[0].name}</p>
                            <p className="text-xs text-gray-400">{leaderboard[0].teamName}</p>
                            <p className="text-yellow-400 font-extrabold text-lg">{leaderboard[0].totalPoints} pts</p>
                        </div>
                        <div className="w-16 h-20 rounded-t-xl bg-yellow-500/20 border border-yellow-500/40 flex items-end justify-center pb-2 text-2xl">🥇</div>
                    </div>
                    {/* 3rd */}
                    <div className="text-center flex flex-col items-center gap-2">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center text-white font-black text-xl shadow-lg">
                            {leaderboard[2].name?.[0]}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">{leaderboard[2].name}</p>
                            <p className="text-xs text-gray-400">{leaderboard[2].teamName}</p>
                            <p className="text-amber-600 font-extrabold">{leaderboard[2].totalPoints} pts</p>
                        </div>
                        <div className="w-16 h-12 rounded-t-xl bg-amber-700/20 border border-amber-700/40 flex items-end justify-center pb-2 text-2xl">🥉</div>
                    </div>
                </div>
            )}

            {/* Full table */}
            {isLoading ? (
                <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" /></div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="table-wrapper hidden md:block">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th className="w-16">Rank</th>
                                    <th>Name</th>
                                    <th>Team</th>
                                    <th>Role</th>
                                    <th className="text-right">Points</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map((entry) => (
                                    <tr key={entry.userId} className={entry.rank <= 3 ? 'bg-primary-500/5' : ''}>
                                        <td>
                                            <span className={RANK_ICON[entry.rank - 1] ? 'text-xl' : 'text-gray-400 font-bold'}>
                                                {RANK_ICON[entry.rank - 1] || `#${entry.rank}`}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                                                    {entry.name?.[0]}
                                                </div>
                                                <span className="font-medium text-white">{entry.name}</span>
                                            </div>
                                        </td>
                                        <td className="text-gray-400">{entry.teamName || '—'}</td>
                                        <td>
                                            <span className={`badge ${entry.role === 'member' ? 'badge-primary' : 'bg-pink-500/20 text-pink-400 badge'}`}>
                                                {ROLE_LABEL[entry.role] || entry.role}
                                            </span>
                                        </td>
                                        <td className="text-right">
                                            <span className={`font-extrabold ${entry.rank === 1 ? 'text-yellow-400' : entry.rank === 2 ? 'text-gray-300' : entry.rank === 3 ? 'text-amber-600' : 'text-primary-400'}`}>
                                                {entry.totalPoints}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {leaderboard.length === 0 && (
                                    <tr><td colSpan={5} className="text-center text-gray-500 py-10">No points recorded yet — leaderboard will populate after task verifications</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="flex flex-col gap-3 md:hidden mt-4">
                        {leaderboard.map((entry) => (
                            <div key={entry.userId} className={`card flex items-center gap-3 p-4 ${entry.rank <= 3 ? 'border-primary-500/50 bg-primary-500/5' : ''}`}>
                                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center font-bold text-lg bg-dark-700 border border-dark-500 rounded-lg">
                                    {RANK_ICON[entry.rank - 1] || `#${entry.rank}`}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className="w-6 h-6 flex-shrink-0 rounded-full bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold">
                                            {entry.name?.[0]}
                                        </div>
                                        <h3 className="font-bold text-white text-sm truncate">{entry.name}</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {entry.teamName && <span className="badge-gray text-[10px] py-0">{entry.teamName}</span>}
                                        <span className={`badge ${entry.role === 'member' ? 'badge-primary' : 'bg-pink-500/20 text-pink-400 badge'} text-[10px] py-0`}>
                                            {ROLE_LABEL[entry.role] || entry.role}
                                        </span>
                                    </div>
                                </div>
                                <div className={`font-black text-lg flex-shrink-0 ${entry.rank === 1 ? 'text-yellow-400' : entry.rank === 2 ? 'text-gray-300' : entry.rank === 3 ? 'text-amber-600' : 'text-primary-400'}`}>
                                    {entry.totalPoints}
                                </div>
                            </div>
                        ))}
                        {leaderboard.length === 0 && <div className="text-center text-gray-500 py-8 card">No points recorded yet</div>}
                    </div>
                </>
            )}
        </div>
    )
}