import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAttendance, getTeams, getUsers, getStudentAttendance } from '../../api'

const today = () => new Date().toISOString().split('T')[0]
const oneMonthAgo = () => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]
}

// Convert records to CSV
const exportCSV = (records, studentName) => {
    const rows = [['Date', 'Team', 'Student', 'Status', 'Task', 'Notes']]
    records.forEach(rec => {
        const date = new Date(rec.date).toLocaleDateString('en-IN')
        const members = rec.presentMembers || []
        members.forEach(m => {
            rows.push([date, rec.teamId?.name || '', m.name || studentName || '', 'Present', rec.taskId?.title || '', rec.notes || ''])
        })
    })
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `attendance_${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
}

export default function FacultyAttendanceReport() {
    const [filters, setFilters] = useState({ teamId: '', startDate: oneMonthAgo(), endDate: today() })
    const [studentView, setStudentView] = useState({ userId: '', name: '' })
    const [view, setView] = useState('table') // 'table' | 'student'

    const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: getTeams })
    const teams = teamsData?.data?.teams || []

    const { data: usersData } = useQuery({ queryKey: ['users'], queryFn: () => getUsers({ limit: 200 }) })
    const users = usersData?.data?.users || []

    const { data: attData, isLoading } = useQuery({
        queryKey: ['faculty-attendance', filters],
        queryFn: () => getAttendance({ teamId: filters.teamId || undefined, startDate: filters.startDate, endDate: filters.endDate }),
        enabled: view === 'table',
    })
    const records = attData?.data?.records || []

    const { data: studentData, isLoading: studentLoading } = useQuery({
        queryKey: ['student-attendance', studentView.userId, filters.startDate, filters.endDate],
        queryFn: () => getStudentAttendance(studentView.userId, { startDate: filters.startDate, endDate: filters.endDate }),
        enabled: view === 'student' && !!studentView.userId,
    })
    const studentRecords = studentData?.data?.records || []
    const studentInfo = studentData?.data?.student

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="page-title mb-0">📋 Attendance Reports</h1>
                <button onClick={() => view === 'table' ? exportCSV(records) : exportCSV(studentRecords, studentInfo?.name)}
                    className="btn-secondary py-2 px-4 text-sm">
                    📥 Export CSV
                </button>
            </div>

            {/* View toggle */}
            <div className="flex gap-2">
                {[['table', '📅 All Records'], ['student', '👤 Per Student']].map(([v, label]) => (
                    <button key={v} onClick={() => setView(v)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${view === v ? 'bg-primary-500 border-primary-500 text-white' : 'bg-dark-700 border-dark-500 text-gray-400'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="card">
                <div className="flex flex-wrap gap-3 items-end">
                    {view === 'table' && (
                        <div>
                            <label className="label">Team</label>
                            <select className="input w-full sm:w-44" value={filters.teamId} onChange={e => setFilters(f => ({ ...f, teamId: e.target.value }))}>
                                <option value="">All Teams</option>
                                {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                        </div>
                    )}
                    {view === 'student' && (
                        <div>
                            <label className="label">Student</label>
                            <select className="input w-full sm:w-56" value={studentView.userId}
                                onChange={e => {
                                    const u = users.find(u => u._id === e.target.value)
                                    setStudentView({ userId: e.target.value, name: u?.name || '' })
                                }}>
                                <option value="">Select student...</option>
                                {users.filter(u => ['volunteer', 'campus_ambassador', 'teamleader'].includes(u.role)).map(u => (
                                    <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="label">From</label>
                        <input type="date" className="input w-full sm:w-40" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
                    </div>
                    <div>
                        <label className="label">To</label>
                        <input type="date" className="input w-full sm:w-40" max={today()} value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
                    </div>
                </div>
            </div>

            {/* All Records Table */}
            {view === 'table' && (
                isLoading ? (
                    <div className="flex justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500 mt-8" /></div>
                ) : (
                    <div className="card overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-dark-500 text-left text-gray-500 text-xs uppercase tracking-wider">
                                    <th className="pb-3 pr-4">Date</th>
                                    <th className="pb-3 pr-4">Team</th>
                                    <th className="pb-3 pr-4">Present Members</th>
                                    <th className="pb-3 pr-4">Count</th>
                                    <th className="pb-3 pr-4">Task</th>
                                    <th className="pb-3">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-600">
                                {records.map(rec => (
                                    <tr key={rec._id} className="hover:bg-dark-700/50 transition-colors">
                                        <td className="py-3 pr-4 text-white font-medium whitespace-nowrap">{new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                                        <td className="py-3 pr-4"><span className="badge-gray text-xs">{rec.teamId?.name}</span></td>
                                        <td className="py-3 pr-4">
                                            <div className="flex flex-wrap gap-1">
                                                {rec.presentMembers.map(m => <span key={m._id} className="badge-success text-xs">{m.name}</span>)}
                                            </div>
                                        </td>
                                        <td className="py-3 pr-4 text-emerald-400 font-bold">{rec.presentMembers.length}</td>
                                        <td className="py-3 pr-4 text-primary-400 text-xs">{rec.taskId?.title || '—'}</td>
                                        <td className="py-3 text-gray-400 text-xs italic">{rec.notes || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {records.length === 0 && <p className="text-center text-gray-500 py-10">No records in this range</p>}
                        {records.length > 0 && <p className="text-xs text-gray-600 mt-3 text-right">{records.length} records · Read-only view</p>}
                    </div>
                )
            )}

            {/* Student Summary */}
            {view === 'student' && studentView.userId && (
                studentLoading ? (
                    <div className="flex justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500 mt-8" /></div>
                ) : (
                    <div className="space-y-4">
                        {studentInfo && (
                            <div className="card bg-gradient-to-r from-primary-500/10 to-pink-500/10 border border-primary-500/20">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                                        {studentInfo.name?.[0]?.toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-lg">{studentInfo.name}</p>
                                        <p className="text-gray-400 text-sm">{studentInfo.role} · {studentInfo.email}</p>
                                    </div>
                                    <div className="ml-auto text-center">
                                        <p className="text-3xl font-black text-emerald-400">{studentRecords.length}</p>
                                        <p className="text-xs text-gray-500">Days Present</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="card overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-dark-500 text-left text-gray-500 text-xs uppercase">
                                        <th className="pb-3 pr-4">Date</th>
                                        <th className="pb-3 pr-4">Team</th>
                                        <th className="pb-3 pr-4">Task</th>
                                        <th className="pb-3">Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-600">
                                    {studentRecords.map(rec => (
                                        <tr key={rec._id} className="hover:bg-dark-700/50">
                                            <td className="py-3 pr-4 text-white font-medium">{new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                            <td className="py-3 pr-4"><span className="badge-gray text-xs">{rec.teamId?.name}</span></td>
                                            <td className="py-3 pr-4 text-primary-400 text-xs">{rec.taskId?.title || '—'}</td>
                                            <td className="py-3 text-gray-400 text-xs italic">{rec.notes || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {studentRecords.length === 0 && <p className="text-center text-gray-500 py-10">No attendance records found</p>}
                        </div>
                    </div>
                )
            )}
            {view === 'student' && !studentView.userId && (
                <div className="card text-center text-gray-500 py-10">Select a student to view their attendance report</div>
            )}
        </div>
    )
}