import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAttendance, getTeamMembers, markAttendance, deleteAttendance, getTasks } from '../../api'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const today = () => new Date().toISOString().split('T')[0]
// Normalise any value to a plain string (handles ObjectId objects vs strings)
const str = (v) => (v ? String(v) : '')

export default function TLAttendance() {
    const { user } = useAuth()
    const qc = useQueryClient()
    // teamId may be a populated object or a raw string/ObjectId
    const teamId = user?.teamId?._id ? String(user.teamId._id) : str(user?.teamId)

    const [selectedDate, setSelectedDate] = useState(today())
    const [present, setPresent] = useState([])   // array of string IDs
    const [notes, setNotes] = useState('')
    const [taskId, setTaskId] = useState('')
    const [view, setView] = useState('mark')
    const [historyRange, setHistoryRange] = useState({ start: '', end: '' })

    // Team members
    const { data: membersData } = useQuery({
        queryKey: ['attendance-members', teamId],
        queryFn: () => getTeamMembers(teamId),
        enabled: !!teamId,
    })
    const members = membersData?.data?.members || []

    // Team tasks
    const { data: tasksData } = useQuery({
        queryKey: ['tl-tasks'],
        queryFn: () => getTasks({ limit: 50 }),
    })
    const tasks = tasksData?.data?.tasks || []

    // Existing record for selected date
    const { data: recordData, isLoading: recordLoading } = useQuery({
        queryKey: ['attendance', teamId, selectedDate],
        queryFn: () => getAttendance({ teamId, date: selectedDate }),
        enabled: !!teamId && !!selectedDate,
    })
    const existingRecord = recordData?.data?.records?.[0]

    // Sync form state when recordData changes (replaces deprecated onSuccess)
    useEffect(() => {
        const rec = recordData?.data?.records?.[0]
        if (rec) {
            // Ensure we store string IDs so === comparison works with member._id strings
            setPresent(rec.presentMembers.map(m => str(m._id || m)))
            setNotes(rec.notes || '')
            setTaskId(str(rec.taskId?._id || rec.taskId || ''))
        } else if (recordData !== undefined) {
            // Query returned but no record — reset
            setPresent([])
            setNotes('')
            setTaskId('')
        }
    }, [recordData])

    // History
    const { data: histData, isLoading: histLoading } = useQuery({
        queryKey: ['attendance-history', teamId, historyRange],
        queryFn: () => getAttendance({ teamId, startDate: historyRange.start, endDate: historyRange.end }),
        enabled: view === 'history' && !!teamId,
    })
    const history = histData?.data?.records || []

    const markMut = useMutation({
        mutationFn: () => markAttendance({
            teamId,
            date: selectedDate,
            presentMembers: present,   // array of string IDs — backend accepts strings and casts to ObjectId
            taskId: taskId || null,
            notes,
        }),
        onSuccess: () => { qc.invalidateQueries(['attendance']); toast.success('Attendance saved!') },
        onError: (e) => toast.error(e.response?.data?.message || 'Error saving attendance'),
    })

    const delMut = useMutation({
        mutationFn: (id) => deleteAttendance(id),
        onSuccess: () => { qc.invalidateQueries(['attendance']); toast.success('Deleted') },
    })

    // Compare string IDs safely
    const toggleMember = (id) => {
        const sid = str(id)
        setPresent(p => p.includes(sid) ? p.filter(x => x !== sid) : [...p, sid])
    }
    const markAll = () => setPresent(members.map(m => str(m._id)))
    const clearAll = () => setPresent([])

    return (
        <div className="space-y-5 animate-fade-in">
            <h1 className="page-title">📋 Team Attendance</h1>

            <div className="flex gap-2">
                {[['mark', '✏️ Mark Attendance'], ['history', '📅 History']].map(([v, label]) => (
                    <button key={v} onClick={() => setView(v)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${view === v ? 'bg-primary-500 border-primary-500 text-white' : 'bg-dark-700 border-dark-500 text-gray-400'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {view === 'mark' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Left: controls */}
                    <div className="card space-y-4">
                        <h2 className="font-bold text-white text-sm uppercase tracking-wider">📅 Select Date</h2>
                        <input type="date" className="input" value={selectedDate} max={today()}
                            onChange={(e) => setSelectedDate(e.target.value)} />
                        <div>
                            <label className="label">🔗 Link to Task (optional)</label>
                            <select className="input" value={taskId} onChange={e => setTaskId(e.target.value)}>
                                <option value="">None</option>
                                {tasks.map(t => <option key={t._id} value={str(t._id)}>{t.title}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">📝 Notes (optional)</label>
                            <textarea className="input" rows={3} placeholder="e.g. Sponsor meeting, Stage setup..." value={notes} onChange={e => setNotes(e.target.value)} />
                        </div>
                        <button onClick={() => markMut.mutate()} disabled={markMut.isPending} className="btn-primary w-full justify-center">
                            {markMut.isPending ? '⏳ Saving...' : existingRecord ? '💾 Update Attendance' : '✅ Save Attendance'}
                        </button>
                        {existingRecord && (
                            <button onClick={() => { if (window.confirm('Delete this attendance record?')) delMut.mutate(existingRecord._id) }}
                                className="btn-danger w-full justify-center text-sm">🗑️ Delete Record</button>
                        )}
                    </div>

                    {/* Right: member checklist */}
                    <div className="lg:col-span-2 card space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <h2 className="font-bold text-white">
                                👥 Members — {present.length}/{members.length} Present
                            </h2>
                            <div className="flex gap-2">
                                <button onClick={markAll} className="btn-secondary py-1 px-3 text-xs">✅ All Present</button>
                                <button onClick={clearAll} className="btn-secondary py-1 px-3 text-xs">❌ All Absent</button>
                            </div>
                        </div>
                        {recordLoading ? (
                            <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" /></div>
                        ) : members.length === 0 ? (
                            <p className="text-gray-500 text-sm">No members found in your team.</p>
                        ) : (
                            <div className="space-y-2">
                                {members.map(m => {
                                    const memberId = str(m._id)
                                    const isPresent = present.includes(memberId)
                                    const ROLE_COLOR = { teamleader: 'text-amber-400', member: 'text-blue-400', volunteer: 'text-blue-400', campus_ambassador: 'text-pink-400' }
                                    return (
                                        <div key={memberId}
                                            onClick={() => toggleMember(memberId)}
                                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${isPresent ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-dark-700 border-dark-500 hover:border-dark-400'}`}>
                                            <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all ${isPresent ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-dark-400'}`}>
                                                {isPresent && <span className="text-xs">✓</span>}
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                                {m.name?.[0]?.toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-white text-sm">{m.name}</p>
                                                <p className={`text-xs ${ROLE_COLOR[m.role] || 'text-gray-400'}`}>{m.role}</p>
                                            </div>
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPresent ? 'bg-emerald-500/20 text-emerald-400' : 'bg-dark-600 text-gray-500'}`}>
                                                {isPresent ? 'Present' : 'Absent'}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {view === 'history' && (
                <div className="space-y-4">
                    <div className="flex gap-3 flex-wrap items-center">
                        <div>
                            <label className="label">From</label>
                            <input type="date" className="input w-full sm:w-40" value={historyRange.start} onChange={e => setHistoryRange(r => ({ ...r, start: e.target.value }))} />
                        </div>
                        <div>
                            <label className="label">To</label>
                            <input type="date" className="input w-full sm:w-40" value={historyRange.end} max={today()} onChange={e => setHistoryRange(r => ({ ...r, end: e.target.value }))} />
                        </div>
                    </div>

                    {histLoading ? <div className="flex justify-center h-24"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500 mt-8" /></div> : (
                        <div className="space-y-3">
                            {history.map(rec => (
                                <div key={rec._id} className="card">
                                    <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div>
                                            <p className="font-bold text-white">📅 {new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                            <p className="text-sm text-gray-400 mt-1">
                                                ✅ {rec.presentMembers.length} present
                                                {rec.taskId && <span className="ml-3 text-primary-400">🔗 {rec.taskId.title}</span>}
                                                {rec.notes && <span className="ml-3 text-gray-500 italic">"{rec.notes}"</span>}
                                            </p>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {rec.presentMembers.map(m => (
                                                    <span key={str(m._id)} className="badge-success text-xs">{m.name}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <button onClick={() => { setSelectedDate(new Date(rec.date).toISOString().split('T')[0]); setView('mark') }}
                                            className="btn-secondary py-1 px-3 text-xs">✏️ Edit</button>
                                    </div>
                                </div>
                            ))}
                            {history.length === 0 && <div className="card text-center text-gray-500 py-10">No attendance records in this range</div>}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}