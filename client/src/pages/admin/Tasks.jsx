import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTasks, createTask, updateTask, deleteTask, getTeams, getUsers, getSubmissions, verifySubmission, closeTask } from '../../api'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const STATUS_MAP = { open: { label: 'Open', class: 'badge-primary' }, submitted: { label: 'Submitted', class: 'badge-warning' }, verified: { label: 'Verified', class: 'badge-success' }, rejected: { label: 'Rejected', class: 'badge-danger' }, closed: { label: 'Closed', class: 'bg-gray-500/20 text-gray-400 badge' } }
const PRIORITY_MAP = { low: { class: 'badge-gray', emoji: '🔵' }, medium: { class: 'badge-primary', emoji: '🟡' }, high: { class: 'badge-warning', emoji: '🟠' }, urgent: { class: 'badge-danger', emoji: '🔴' } }

function Modal({ open, onClose, title, children }) {
    if (!open) return null
    return <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-dark-500"><h3 className="text-lg font-bold text-white">{title}</h3><button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button></div>
        <div className="p-5">{children}</div>
    </div></div>
}

function TaskForm({ initial, teamId: forcedTeamId, onSubmit, loading }) {
    const { user } = useAuth()
    const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: getTeams, enabled: user.role === 'admin' })
    const teams = teamsData?.data?.teams || []
    const [form, setForm] = useState(initial || { title: '', description: '', teamId: forcedTeamId || '', assignees: [], deadline: '', priority: 'medium', basePoints: 10 })
    const selectedTeam = form.teamId

    const { data: usersData } = useQuery({
        queryKey: ['users-for-assign', selectedTeam],
        queryFn: () => getUsers({ teamId: selectedTeam, limit: 50 }),
        enabled: !!selectedTeam,
    })
    const volunteers = (usersData?.data?.users || []).filter(u => u.role !== 'teamleader')

    const f = (k) => (v) => setForm((s) => ({ ...s, [k]: typeof v === 'object' ? v.target.value : v }))
    const toggleAssignee = (id) => setForm((s) => ({
        ...s, assignees: s.assignees.includes(id) ? s.assignees.filter((a) => a !== id) : [...s.assignees, id]
    }))

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
            <div><label className="label">Title *</label><input className="input" value={form.title} onChange={f('title')} required /></div>
            <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={f('description')} /></div>

            {user.role === 'admin' && (
                <div><label className="label">Team *</label>
                    <select className="input" value={form.teamId} onChange={f('teamId')} required>
                        <option value="">Select team</option>
                        {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="label">Priority</label>
                    <select className="input" value={form.priority} onChange={f('priority')}>
                        {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{`${PRIORITY_MAP[p].emoji} ${p}`}</option>)}
                    </select>
                </div>
                <div><label className="label">Base Points</label><input type="number" className="input" min={0} value={form.basePoints} onChange={f('basePoints')} /></div>
            </div>

            <div><label className="label">Deadline</label><input type="datetime-local" className="input" value={form.deadline ? form.deadline.slice(0, 16) : ''} onChange={f('deadline')} /></div>

            {selectedTeam && (
                <div>
                    <label className="label">Assignees ({volunteers.length} available)</label>
                    <div className="max-h-32 overflow-y-auto space-y-1 border border-dark-500 rounded-lg p-2">
                        {volunteers.length === 0 && <p className="text-gray-500 text-sm p-2">No members in this team</p>}
                        {volunteers.map((u) => (
                            <label key={u._id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-dark-600 cursor-pointer">
                                <input type="checkbox" checked={form.assignees.includes(u._id)} onChange={() => toggleAssignee(u._id)} className="rounded" />
                                <span className="text-sm text-gray-200">{u.name}</span>
                                <span className="badge-gray text-xs ml-auto">{u.role}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
                {loading ? '⏳ Saving...' : (initial ? '💾 Update Task' : '➕ Create Task')}
            </button>
        </form>
    )
}

function SubmissionsList({ taskId, basePoints }) {
    const qc = useQueryClient()
    const { data, isLoading } = useQuery({
        queryKey: ['submissions', taskId],
        queryFn: () => getSubmissions({ taskId, limit: 50 }),
        enabled: !!taskId
    })
    const submissions = data?.data?.submissions || []

    const verifyMut = useMutation({
        mutationFn: ({ id, ...d }) => verifySubmission(id, d),
        onSuccess: () => { qc.invalidateQueries(['submissions']); qc.invalidateQueries(['tasks']); toast.success('Submission processed!') },
        onError: (e) => toast.error(e.response?.data?.message || 'Error')
    })

    const [verifyState, setVerifyState] = useState({ id: null, status: 'verified', awardedPoints: basePoints || 0, rejectionReason: '' })

    if (isLoading) return <div className="text-gray-400 text-center py-4"><div className="animate-spin inline-block rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-500 mr-2" /> Loading...</div>
    if (submissions.length === 0) return <div className="text-gray-500 text-center py-4 bg-dark-700 rounded-lg border border-dark-500">No submissions yet for this task.</div>

    return (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {submissions.map(sub => (
                <div key={sub._id} className="p-3 bg-dark-700 rounded-lg border border-dark-500">
                    <div className="flex justify-between items-start mb-2 gap-2 flex-wrap">
                        <div className="min-w-0">
                            <p className="text-white text-sm font-medium">{sub.submittedBy?.name} <span className="text-xs text-gray-400 ml-1">({sub.submittedBy?.role})</span></p>
                            <p className="text-xs text-gray-400">{new Date(sub.createdAt).toLocaleString()}</p>
                        </div>
                        {sub.status === 'verified' && <span className="badge-success text-xs">✅ {sub.awardedPoints} pts</span>}
                        {sub.status === 'rejected' && <span className="badge-danger text-xs">❌ Rejected</span>}
                        {sub.status === 'pending' && <span className="badge-warning text-xs">⏳ Pending</span>}
                    </div>
                    {sub.note && <p className="text-xs text-gray-300 italic mb-2">"{sub.note}"</p>}
                    <div className="flex gap-2">
                        {sub.proofType === 'link' && <a href={sub.proofValue} target="_blank" rel="noreferrer" className="btn-secondary py-1 px-2 text-xs">🔗 Link</a>}
                        {sub.proofType === 'file' && <a href={sub.proofValue} target="_blank" rel="noreferrer" className="btn-secondary py-1 px-2 text-xs">📄 File</a>}
                        {sub.proofType === 'text' && <div className="text-xs text-gray-300 bg-dark-800 p-2 rounded w-full border border-dark-600 font-mono break-words overflow-hidden">{sub.proofValue}</div>}
                    </div>
                    {sub.rejectionReason && <p className="text-xs text-red-400 mt-2 bg-red-900/20 p-2 rounded border border-red-500/20"><strong>Reason:</strong> {sub.rejectionReason}</p>}

                    {sub.status === 'pending' && verifyState.id !== sub._id && (
                        <div className="mt-3 pt-3 border-t border-dark-500">
                            <button onClick={() => setVerifyState({ id: sub._id, status: 'verified', awardedPoints: basePoints || 0, rejectionReason: '' })} className="btn-primary py-1 px-3 text-xs w-full justify-center">✔️ Review Submission</button>
                        </div>
                    )}

                    {verifyState.id === sub._id && (
                        <div className="mt-3 pt-3 border-t border-dark-500 space-y-3 bg-dark-800 p-3 rounded-lg border border-dark-600">
                            <div className="flex gap-2">
                                <button onClick={() => setVerifyState(s => ({ ...s, status: 'verified' }))} className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${verifyState.status === 'verified' ? 'bg-emerald-600 text-white' : 'bg-dark-600 text-gray-400'}`}>✅ Verify</button>
                                <button onClick={() => setVerifyState(s => ({ ...s, status: 'rejected' }))} className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${verifyState.status === 'rejected' ? 'bg-red-600 text-white' : 'bg-dark-600 text-gray-400'}`}>❌ Reject</button>
                            </div>

                            {verifyState.status === 'verified' && (
                                <div><label className="text-xs text-gray-400 block mb-1">Points to Award</label><input type="number" className="input py-1 text-sm" value={verifyState.awardedPoints} onChange={e => setVerifyState(s => ({ ...s, awardedPoints: Number(e.target.value) }))} /></div>
                            )}
                            {verifyState.status === 'rejected' && (
                                <div><label className="text-xs text-gray-400 block mb-1">Rejection Reason</label><input type="text" className="input py-1 text-sm" value={verifyState.rejectionReason} onChange={e => setVerifyState(s => ({ ...s, rejectionReason: e.target.value }))} placeholder="Why is this rejected?" /></div>
                            )}

                            <div className="flex gap-2">
                                <button className="btn-secondary py-1 text-xs flex-1" onClick={() => setVerifyState({ id: null })}>Cancel</button>
                                <button className={`py-1 px-3 text-xs font-bold rounded flex-1 ${verifyState.status === 'verified' ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-red-600 text-white hover:bg-red-500'}`} onClick={() => verifyMut.mutate({ id: sub._id, status: verifyState.status, awardedPoints: verifyState.awardedPoints, rejectionReason: verifyState.rejectionReason })} disabled={verifyMut.isPending}>{verifyMut.isPending ? '⏳...' : 'Confirm'}</button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

export default function AdminTasks() {
    const { user } = useAuth()
    const qc = useQueryClient()
    const [modal, setModal] = useState(null)
    const [filters, setFilters] = useState({ status: '', priority: '' })
    const [page, setPage] = useState(1)

    const { data, isLoading } = useQuery({
        queryKey: ['tasks', filters, page],
        queryFn: () => getTasks({ ...filters, page, limit: 15 }),
    })
    const tasks = data?.data?.tasks || []
    const total = data?.data?.total || 0
    const pages = data?.data?.pages || 1

    const createMut = useMutation({ mutationFn: createTask, onSuccess: () => { qc.invalidateQueries(['tasks']); setModal(null); toast.success('Task created!') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })
    const updateMut = useMutation({ mutationFn: ({ id, ...d }) => updateTask(id, d), onSuccess: () => { qc.invalidateQueries(['tasks']); setModal(null); toast.success('Task updated!') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })
    const deleteMut = useMutation({ mutationFn: deleteTask, onSuccess: () => { qc.invalidateQueries(['tasks']); toast.success('Task deleted') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })
    const closeMut = useMutation({ mutationFn: ({ id, closeNote }) => closeTask(id, { closeNote }), onSuccess: () => { qc.invalidateQueries(['tasks']); setModal(null); toast.success('Task closed') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })
    const [closeNote, setCloseNote] = useState('')

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="page-title mb-0 text-xl sm:text-2xl">✅ Tasks ({total})</h1>
                <button onClick={() => setModal({ type: 'create' })} className="btn-primary w-full sm:w-auto justify-center">➕ Create Task</button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <select className="input w-full sm:max-w-xs" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                    <option value="">All Statuses</option>
                    {Object.keys(STATUS_MAP).map((s) => <option key={s} value={s}>{STATUS_MAP[s].label}</option>)}
                </select>
                <select className="input w-full sm:max-w-xs" value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}>
                    <option value="">All Priorities</option>
                    {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{`${PRIORITY_MAP[p].emoji} ${p}`}</option>)}
                </select>
            </div>

            {isLoading ? <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" /></div> : (
                <>
                    {/* Desktop Table View */}
                    <div className="table-wrapper hidden md:block">
                        <table className="table">
                            <thead><tr><th>Title</th><th>Team</th><th>Assignees</th><th>Priority</th><th>Status</th><th>Deadline</th><th>Pts</th><th>Actions</th></tr></thead>
                            <tbody>
                                {tasks.map((t) => (
                                    <tr key={t._id}>
                                        <td className="font-medium text-white max-w-xs truncate">{t.title}</td>
                                        <td>{t.teamId?.name ? <span className="badge-gray">{t.teamId.name}</span> : '—'}</td>
                                        <td className="text-gray-400 text-xs">{t.assignees?.length > 0 ? t.assignees.map((a) => a.name).join(', ') : <span className="text-gray-500">Unassigned</span>}</td>
                                        <td><span className={`${PRIORITY_MAP[t.priority]?.class || 'badge-gray'} badge`}>{PRIORITY_MAP[t.priority]?.emoji} {t.priority}</span></td>
                                        <td><span className={STATUS_MAP[t.status]?.class}>{STATUS_MAP[t.status]?.label}</span></td>
                                        <td className="text-gray-400 text-xs">{t.deadline ? new Date(t.deadline).toLocaleDateString() : '—'}</td>
                                        <td className="text-primary-400 font-bold">{t.basePoints}</td>
                                        <td>
                                            <div className="flex gap-1 flex-wrap">
                                                <button onClick={() => setModal({ type: 'view-subs', taskId: t._id, taskTitle: t.title, basePoints: t.basePoints })} className="btn-secondary py-1 px-2 text-xs tooltip-trigger" title="View Submissions">👀</button>
                                                <button onClick={() => setModal({ type: 'edit', task: t })} className="btn-secondary py-1 px-2 text-xs tooltip-trigger" title="Edit Task">✏️</button>
                                                {t.status !== 'closed' && t.status !== 'verified' && (
                                                    <button onClick={() => { setCloseNote(''); setModal({ type: 'close', taskId: t._id, taskTitle: t.title }) }} className="bg-gray-600/30 text-gray-300 hover:bg-gray-500/30 py-1 px-2 text-xs rounded font-medium transition-colors" title="Close Task">🔒</button>
                                                )}
                                                <button onClick={() => { if (window.confirm('Delete this task?')) deleteMut.mutate(t._id) }} className="btn-danger py-1 px-2 text-xs tooltip-trigger" title="Delete Task">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {tasks.length === 0 && <tr><td colSpan={8} className="text-center text-gray-500 py-8">No tasks found</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
                        {tasks.map((t) => (
                            <div key={t._id} className="card flex flex-col gap-3">
                                <div>
                                    <h3 className="font-bold text-white text-base leading-tight">{t.title}</h3>
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        {t.teamId?.name ? <span className="badge-gray text-[10px]">{t.teamId.name}</span> : <span className="text-gray-500 text-xs">—</span>}
                                        <span className={`${PRIORITY_MAP[t.priority]?.class || 'badge-gray'} badge text-[10px]`}>{PRIORITY_MAP[t.priority]?.emoji} {t.priority}</span>
                                        <span className={`${STATUS_MAP[t.status]?.class} text-[10px]`}>{STATUS_MAP[t.status]?.label}</span>
                                        <span className="text-primary-400 font-bold text-xs ml-auto">{t.basePoints} pts</span>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-400 space-y-1">
                                    <p><span className="font-semibold text-gray-300">Deadline:</span> {t.deadline ? new Date(t.deadline).toLocaleDateString() : '—'}</p>
                                    <p><span className="font-semibold text-gray-300">Assignees:</span> {t.assignees?.length > 0 ? t.assignees.map((a) => a.name).join(', ') : <span className="text-gray-500">Unassigned</span>}</p>
                                </div>
                                <div className="flex gap-2 pt-3 border-t border-dark-500 mt-auto flex-wrap">
                                    <button onClick={() => setModal({ type: 'view-subs', taskId: t._id, taskTitle: t.title, basePoints: t.basePoints })} className="btn-secondary py-1.5 px-2 text-xs flex-1 justify-center" title="View Submissions">👀 View</button>
                                    <button onClick={() => setModal({ type: 'edit', task: t })} className="btn-secondary py-1.5 px-2 text-xs flex-1 justify-center" title="Edit Task">✏️ Edit</button>
                                    {t.status !== 'closed' && t.status !== 'verified' && (
                                        <button onClick={() => { setCloseNote(''); setModal({ type: 'close', taskId: t._id, taskTitle: t.title }) }} className="btn-secondary py-1.5 px-2 text-xs flex-1 justify-center transition-colors" title="Close Task">🔒 Close</button>
                                    )}
                                    <button onClick={() => { if (window.confirm('Delete this task?')) deleteMut.mutate(t._id) }} className="btn-danger py-1.5 px-3 text-xs w-auto justify-center" title="Delete Task">🗑️</button>
                                </div>
                            </div>
                        ))}
                        {tasks.length === 0 && <div className="col-span-1 sm:col-span-2 text-center text-gray-500 py-8 card">No tasks found</div>}
                    </div>
                </>
            )}

            {pages > 1 && (
                <div className="flex items-center gap-2 justify-center">
                    <button className="btn-secondary py-1 px-3" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</button>
                    <span className="text-gray-400 text-sm">Page {page} of {pages}</span>
                    <button className="btn-secondary py-1 px-3" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>›</button>
                </div>
            )}

            <Modal open={modal?.type === 'create'} onClose={() => setModal(null)} title="Create Task">
                <TaskForm
                    teamId={user.teamId?._id || user.teamId || ''}
                    onSubmit={(form) => createMut.mutate({ ...form, teamId: form.teamId?._id || form.teamId || undefined })}
                    loading={createMut.isPending}
                />
            </Modal>
            <Modal open={modal?.type === 'edit'} onClose={() => setModal(null)} title="Edit Task">
                {modal?.task && <TaskForm
                    initial={{ ...modal.task, teamId: modal.task.teamId?._id || '', assignees: modal.task.assignees?.map((a) => a._id || a) || [] }}
                    onSubmit={(d) => updateMut.mutate({ id: modal.task._id, ...d })}
                    loading={updateMut.isPending}
                />}
            </Modal>
            <Modal open={modal?.type === 'view-subs'} onClose={() => setModal(null)} title={`Submissions: ${modal?.taskTitle}`}>
                {modal?.taskId && <SubmissionsList taskId={modal.taskId} basePoints={modal.basePoints} />}
            </Modal>
            <Modal open={modal?.type === 'close'} onClose={() => setModal(null)} title={`Close Task: ${modal?.taskTitle}`}>
                <div className="space-y-4">
                    <p className="text-gray-400 text-sm">This will mark the task as <strong className="text-gray-200">Closed</strong>. No further submissions will be accepted.</p>
                    <div><label className="label">Reason / Note (optional)</label><textarea className="input" rows={3} value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="e.g. Cancelled, no longer needed" /></div>
                    <button className="btn-primary w-full justify-center bg-gray-600 hover:bg-gray-500 border-gray-500" disabled={closeMut.isPending} onClick={() => closeMut.mutate({ id: modal.taskId, closeNote })}>
                        {closeMut.isPending ? '⏳ Closing...' : '🔒 Close Task'}
                    </button>
                </div>
            </Modal>
        </div>
    )
}