import { useQuery } from '@tanstack/react-query'
import { getStudentAttendance } from '../../api'
import { useAuth } from '../../context/AuthContext'

export default function MyAttendance() {
    const { user } = useAuth()
    // user object uses _id (from MongoDB toSafeObject) not virtual .id
    const userId = user?._id ? String(user._id) : user?.id

    const { data, isLoading } = useQuery({
        queryKey: ['my-attendance', userId],
        queryFn: () => getStudentAttendance(userId),
        enabled: !!userId,
    })

    const records = data?.data?.records || []
    const total = data?.data?.totalPresent || 0

    return (
        <div className="space-y-5 animate-fade-in">
            <h1 className="page-title">📋 My Attendance</h1>
            <p className="text-xs text-gray-500 bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 inline-block">
                👁️ Read-only · Attendance is marked by your Team Leader. Contact admin if you see any discrepancy.
            </p>

            {isLoading ? (
                <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" /></div>
            ) : (
                <>
                    {/* Summary card */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="card bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
                            <p className="text-4xl font-black text-emerald-400">{total}</p>
                            <p className="text-gray-400 text-sm mt-1">Total Days Present</p>
                        </div>
                        <div className="card bg-dark-700 border border-dark-500">
                            <p className="text-4xl font-black text-primary-400">{records.length > 0 ? new Date(records[records.length - 1].date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '—'}</p>
                            <p className="text-gray-400 text-sm mt-1">First Day Marked</p>
                        </div>
                    </div>

                    {/* Records list */}
                    <div className="space-y-3">
                        {records.map(rec => (
                            <div key={rec._id} className="card border-l-4 border-l-emerald-500">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div>
                                        <p className="font-bold text-white">
                                            ✅ {new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                        <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-gray-400">
                                            {rec.teamId && <span className="badge-gray">{rec.teamId.name}</span>}
                                            {rec.taskId && <span className="badge-primary">🔗 {rec.taskId.title}</span>}
                                            {rec.notes && <span className="italic text-gray-500">"{rec.notes}"</span>}
                                        </div>
                                    </div>
                                    <span className="badge-success text-xs self-start">Present</span>
                                </div>
                            </div>
                        ))}
                        {records.length === 0 && (
                            <div className="card text-center py-12">
                                <p className="text-gray-500 text-sm">No attendance records yet.</p>
                                <p className="text-gray-600 text-xs mt-2">Your Team Leader will mark attendance for each day you work on TechFest tasks.</p>
                            </div>
                        )}
                    </div>

                    {records.length > 0 && (
                        <div className="card border border-amber-500/20 bg-amber-500/5">
                            <p className="text-amber-400 text-sm">⚠️ If you believe your attendance is incorrect, contact your Team Leader or Admin (<a href="mailto:admin@techfest.com" className="underline">admin@techfest.com</a>).</p>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}