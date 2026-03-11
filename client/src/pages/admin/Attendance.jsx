import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAttendance, getTeamMembers, markAttendance, deleteAttendance, getAttendanceSummary, getTeams, getTasks } from '../../api'
import toast from 'react-hot-toast'

const today = () => new Date().toISOString().split('T')[0]
const str = (v) => (v ? String(v) : '')

export default function AdminAttendance() {
    const qc = useQueryClient()
    const [selectedTeam, setSelectedTeam] = useState('')
    const [selectedDate, setSelectedDate] = useState(today())
    const [present, setPresent] = useState([])
    const [notes, setNotes] = useState('')
    const [taskLink, setTaskLink] = useState('')
    const [view, setView] = useState('mark') // 'mark' | 'history' | 'stats'
    const [histRange, setHistRange] = useState({ start: '', end: '', team: '' })

    const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: getTeams })
    const teams = teamsData?.data?.teams || []

    const { data: membersData } = useQuery({
        queryKey: ['attendance-members', selectedTeam],
        queryFn: () => getTeamMembers(selectedTeam),
        enabled: !!selectedTeam,
    })
    const members = membersData?.data?.members || []

    const { data: tasksData } = useQuery({
        queryKey: ['admin-tasks', selectedTeam],
        queryFn: () => getTasks({ teamId: selectedTeam, limit: 50 }),
        enabled: !!selectedTeam,
    })
    const tasks = tasksData?.data?.tasks || []

    const { data: recordData, isLoading: recordLoading } = useQuery({
        queryKey: ['attendance', selectedTeam, selectedDate],
        queryFn: () => getAttendance({ teamId: selectedTeam, date: selectedDate }),
        enabled: !!selectedTeam && !!selectedDate,
    })
    const existingRecord = recordData?.data?.records?.[0]

    // Sync form when record loads (replaces deprecated onSuccess)
    useEffect(() => {
        const rec = recordData?.data?.records?.[0]
        if (rec) {
            setPresent(rec.presentMembers.map(m => str(m._id || m)))
            setNotes(rec.notes || '')
            setTaskLink(str(rec.taskId?._id || rec.taskId || ''))
        } else if (recordData !== undefined) {
            setPresent([]); setNotes(''); setTaskLink('')
        }
    }, [recordData])

    const { data: histData } = useQuery({
        queryKey: ['attendance-hist', histRange],
        queryFn: () => getAttendance({ teamId: histRange.team || undefined, startDate: histRange.start, endDate: histRange.end }),
        enabled: view === 'history',
    })
    const history = histData?.data?.records || []

    const { data: statsData } = useQuery({
        queryKey: ['attendance-summary'],
        queryFn: () => getAttendanceSummary(),
        enabled: view === 'stats',
    })
    const stats = statsData?.data?.stats || []

    const markMut = useMutation({
        mutationFn: () => markAttendance({ teamId: selectedTeam, date: selectedDate, presentMembers: present, taskId: taskLink || null, notes }),
        onSuccess: () => { qc.invalidateQueries(['attendance']); toast.success('Attendance saved!') },
        onError: (e) => toast.error(e.response?.data?.message || 'Error'),
    })
    const delMut = useMutation({
        mutationFn: (id) => deleteAttendance(id),
        onSuccess: () => { qc.invalidateQueries(['attendance']); toast.success('Deleted') },
    })

    const toggleMember = (id) => setPresent(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

    return (
        <div className="space-y-5 animate-fade-in">
            <h1 className="page-title">📋 Attendance Management</h1>

            <div className="flex gap-2 flex-wrap">
                {[['mark', '✏️ Mark'], ['history', '📅 History'], ['stats', '📊 Stats']].map(([v, label]) => (
                    <button key={v} onClick={() => setView(v)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${view === v ? 'bg-primary-500 border-primary-500 text-white' : 'bg-dark-700 border-dark-500 text-gray-400'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {view === 'mark' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="card space-y-4">
                        <h2 className="font-bold text-white text-sm uppercase tracking-wider">📅 Select Day</h2>
                        <div>
                            <label className="label">Team</label>
                            <select className="input" value={selectedTeam} onChange={e => { setSelectedTeam(e.target.value); setPresent([]) }}>
                                <option value="">Select team...</option>
                                {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Date</label>
                            <input type="date" className="input" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="label">Link Task (optional)</label>
                            <select className="input" value={taskLink} onChange={e => setTaskLink(e.target.value)}>
                                <option value="">None</option>
                                {tasks.map(t => <option key={t._id} value={t._id}>{t.title}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Notes</label>
                            <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Meeting, setup, etc..." />
                        </div>
                        {selectedTeam && (
                            <>
                                <button onClick={() => markMut.mutate()} disabled={markMut.isPending} className="btn-primary w-full justify-center">
                                    {markMut.isPending ? '⏳...' : existingRecord ? '💾 Update' : '✅ Save Attendance'}
                                </button>
                                {existingRecord && (
                                    <button onClick={() => { if (window.confirm('Delete?')) delMut.mutate(existingRecord._id) }} className="btn-danger w-full justify-center text-sm">🗑️ Delete</button>
                                )}
                            </>
                        )}
                    </div>

                    <div className="lg:col-span-2 card space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <h2 className="font-bold text-white">👥 {members.length} Members — {present.length} Present</h2>
                            <div className="flex gap-2">
                                <button onClick={() => setPresent(members.map(m => m._id))} className="btn-secondary py-1 px-3 text-xs">All ✅</button>
                                <button onClick={() => setPresent([])} className="btn-secondary py-1 px-3 text-xs">All ❌</button>
                            </div>
                        </div>
                        {!selectedTeam ? (
                            <p className="text-gray-500 text-sm text-center py-10">Select a team to start marking attendance</p>
                        ) : recordLoading ? (
                            <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500" /></div>
                        ) : (
                            <div className="space-y-2">
                                {members.map(m => {
                                    const memberId = str(m._id)
                                    const isPresent = present.includes(memberId)
                                    return (
                                        <div key={memberId} onClick={() => setPresent(p => p.includes(memberId) ? p.filter(x => x !== memberId) : [...p, memberId])}
                                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${isPresent ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-dark-700 border-dark-500 hover:border-dark-400'}`}>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${isPresent ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-dark-400'}`}>
                                                {isPresent && <span className="text-xs">✓</span>}
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                                {m.name?.[0]?.toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-white text-sm">{m.name}</p>
                                                <p className="text-xs text-gray-500">{m.role} · {m.email}</p>
                                            </div>
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPresent ? 'bg-emerald-500/20 text-emerald-400' : 'bg-dark-600 text-gray-500'}`}>
                                                {isPresent ? 'Present' : 'Absent'}
                                            </span>
                                        </div>
                                    )
                                })}
                                {members.length === 0 && <p className="text-gray-500 text-sm text-center py-6">No members in this team</p>}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {view === 'history' && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                        <div className="w-full sm:w-auto">
                            <label className="label">Team</label>
                            <select className="input w-full sm:w-44" value={histRange.team} onChange={e => setHistRange(r => ({ ...r, team: e.target.value }))}>
                                <option value="">All Teams</option>
                                {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div className="w-full sm:w-auto">
                            <label className="label">From</label>
                            <input type="date" className="input w-full sm:w-40" value={histRange.start} onChange={e => setHistRange(r => ({ ...r, start: e.target.value }))} />
                        </div>
                        <div className="w-full sm:w-auto">
                            <label className="label">To</label>
                            <input type="date" className="input w-full sm:w-40" max={today()} value={histRange.end} onChange={e => setHistRange(r => ({ ...r, end: e.target.value }))} />
                        </div>
                    </div>

                    <div className="space-y-3">
                        {history.map(rec => (
                            <div key={rec._id} className="card">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-white">📅 {new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                            {rec.teamId && <span className="badge-gray text-xs">{rec.teamId.name}</span>}
                                        </div>
                                        <p className="text-xs text-gray-400">✅ {rec.presentMembers.length} present · Marked by {rec.markedBy?.name}
                                            {rec.taskId && <span className="ml-2 text-primary-400">🔗 {rec.taskId.title}</span>}
                                            {rec.notes && <span className="ml-2 italic">"{rec.notes}"</span>}
                                        </p>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {rec.presentMembers.map(m => <span key={m._id} className="badge-success text-xs">{m.name}</span>)}
                                        </div>
                                    </div>
                                    <button onClick={() => { if (window.confirm('Delete?')) delMut.mutate(rec._id) }} className="btn-danger py-1 px-2 text-xs">🗑️</button>
                                </div>
                            </div>
                        ))}
                        {history.length === 0 && <div className="card text-center text-gray-500 py-10">No records found</div>}
                    </div>
                </div>
            )}

            {view === 'stats' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.map(s => (
                        <div key={s._id} className="card">
                            <h3 className="font-bold text-white mb-3">{s.teamName}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                <div className="bg-dark-700 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-primary-400">{s.totalDays}</p>
                                    <p className="text-gray-500 text-xs mt-1">Days Marked</p>
                                </div>
                                <div className="bg-dark-700 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-emerald-400">{s.avgPresent}</p>
                                    <p className="text-gray-500 text-xs mt-1">Avg Present</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    {stats.length === 0 && <div className="col-span-full card text-center text-gray-500 py-10">No attendance data yet</div>}
                </div>
            )}
        </div>
    )
}