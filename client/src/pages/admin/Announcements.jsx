import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, getTeams } from '../../api'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

const SCOPE_BADGE = { global: 'badge-success', team: 'badge-primary', role: 'badge-warning' }

function Modal({ open, onClose, title, children }) {
    if (!open) return null
    return <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-dark-500"><h3 className="text-lg font-bold text-white">{title}</h3><button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button></div>
        <div className="p-5">{children}</div>
    </div></div>
}

function AnnForm({ initial, onSubmit, loading, userRole }) {
    const { data } = useQuery({ queryKey: ['teams'], queryFn: getTeams })
    const teams = data?.data?.teams || []
    const ROLES = ['admin', 'teamleader', 'faculty', 'member', 'campus_ambassador']

    const isTeamLeader = userRole === 'teamleader'

    const [form, setForm] = useState(initial || {
        title: '',
        body: '',
        scope: isTeamLeader ? 'team' : 'global',
        teamId: '',
        targetRoles: [],
        pinned: false,
        sendEmail: false,
        expiresAt: ''
    })
    const f = (k) => (v) => setForm((s) => ({ ...s, [k]: typeof v === 'object' ? v.target.value : v }))
    const toggleRole = (r) => setForm((s) => ({ ...s, targetRoles: s.targetRoles.includes(r) ? s.targetRoles.filter((x) => x !== r) : [...s.targetRoles, r] }))

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
            <div><label className="label">Title *</label><input className="input" value={form.title} onChange={f('title')} required /></div>
            <div><label className="label">Body (Markdown supported)</label><textarea className="input font-mono text-sm" rows={5} value={form.body} onChange={f('body')} required /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="label">Scope</label>
                    {isTeamLeader ? (
                        <div className="input bg-dark-700 text-gray-400 cursor-not-allowed">🏷️ Team Only (auto)</div>
                    ) : (
                        <select className="input" value={form.scope} onChange={f('scope')}>
                            <option value="global">🌐 Global (everyone)</option>
                            <option value="team">🏷️ Specific Team</option>
                            <option value="role">👤 Specific Roles</option>
                        </select>
                    )}
                </div>
                {form.scope === 'team' && !isTeamLeader && (
                    <div><label className="label">Team</label>
                        <select className="input" value={form.teamId} onChange={f('teamId')}>
                            <option value="">Select team</option>
                            {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                        </select>
                    </div>
                )}
            </div>
            {form.scope === 'role' && !isTeamLeader && (
                <div>
                    <label className="label">Target Roles</label>
                    <div className="flex flex-wrap gap-2">
                        {ROLES.map((r) => <button key={r} type="button" onClick={() => toggleRole(r)} className={`badge px-3 py-1 cursor-pointer ${form.targetRoles.includes(r) ? 'badge-primary border border-primary-500' : 'badge-gray'}`}>{r === 'member' ? 'Member' : r === 'campus_ambassador' ? 'Campus Ambassador' : r === 'teamleader' ? 'Team Leader' : r === 'faculty' ? 'Faculty' : r}</button>)}
                    </div>
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="label">Expires At</label><input type="datetime-local" className="input" value={form.expiresAt || ''} onChange={f('expiresAt')} /></div>
                <div className="flex items-end pb-1"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm((s) => ({ ...s, pinned: e.target.checked }))} /><span className="text-sm text-gray-300">📌 Pin announcement</span></label></div>
            </div>

            {/* Send via Email checkbox */}
            <div className="p-3 rounded-lg bg-dark-700 border border-dark-500">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.sendEmail}
                        onChange={(e) => setForm((s) => ({ ...s, sendEmail: e.target.checked }))}
                        className="w-5 h-5 rounded accent-primary-500"
                    />
                    <div>
                        <span className="text-sm font-medium text-white">📧 Send via Email</span>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {form.sendEmail
                                ? '✅ This announcement will also be emailed to all recipients'
                                : 'Uncheck to keep this announcement web-only (no email sent)'}
                        </p>
                    </div>
                </label>
            </div>

            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>{loading ? '⏳ Saving...' : (initial ? '💾 Update' : '📢 Post Announcement')}</button>
        </form>
    )
}

export default function AdminAnnouncements() {
    const { user } = useAuth()
    const qc = useQueryClient()
    const [modal, setModal] = useState(null)
    const [page, setPage] = useState(1)
    const { data, isLoading } = useQuery({ queryKey: ['announcements', page], queryFn: () => getAnnouncements({ page, limit: 10 }) })
    const anns = data?.data?.announcements || []
    const total = data?.data?.total || 0

    const createMut = useMutation({ mutationFn: createAnnouncement, onSuccess: () => { qc.invalidateQueries(['announcements']); setModal(null); toast.success('Posted!') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })
    const deleteMut = useMutation({ mutationFn: deleteAnnouncement, onSuccess: () => { qc.invalidateQueries(['announcements']); toast.success('Deleted') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="page-title mb-0 min-w-0">📢 Announcements ({total})</h1>
                {(user?.role === 'admin' || user?.role === 'teamleader') && (
                    <button onClick={() => setModal('create')} className="btn-primary w-full sm:w-auto justify-center">➕ New Announcement</button>
                )}
            </div>

            {isLoading ? <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" /></div> : (
                <div className="space-y-3">
                    {anns.map((ann) => (
                        <div key={ann._id} className={`card border-l-4 ${ann.pinned ? 'border-l-amber-500' : 'border-l-dark-500'}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        {ann.pinned && <span className="text-amber-400 text-sm">📌</span>}
                                        <h3 className="font-bold text-white break-words min-w-0">{ann.title}</h3>
                                        <span className={`badge ${SCOPE_BADGE[ann.scope]}`}>{ann.scope}</span>
                                        {ann.teamId && <span className="badge-gray">{ann.teamId.name}</span>}
                                        {ann.sendEmail && <span className="badge bg-blue-500/20 text-blue-400 text-xs">📧 Emailed</span>}
                                    </div>
                                    <div className="text-sm text-gray-400 prose prose-invert max-w-none line-clamp-2 break-words">
                                        <ReactMarkdown>{ann.body}</ReactMarkdown>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">by {ann.createdBy?.name} · {new Date(ann.createdAt).toLocaleString()}</p>
                                </div>
                                {(user?.role === 'admin' || (user?.role === 'teamleader' && user?._id === ann.createdBy?._id)) && (
                                    <button onClick={() => { if (window.confirm('Delete?')) deleteMut.mutate(ann._id) }} className="btn-danger py-1 px-2 text-xs flex-shrink-0">🗑️</button>
                                )}
                            </div>
                        </div>
                    ))}
                    {anns.length === 0 && <div className="card text-center text-gray-500 py-10">No announcements yet</div>}
                </div>
            )}

            <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Post Announcement">
                <AnnForm onSubmit={createMut.mutate} loading={createMut.isPending} userRole={user?.role} />
            </Modal>
        </div>
    )
}