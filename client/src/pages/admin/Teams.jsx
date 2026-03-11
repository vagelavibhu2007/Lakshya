import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTeams, createTeam, updateTeam, deleteTeam, getUsers } from '../../api'
import toast from 'react-hot-toast'

const TEAM_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316']

function Modal({ open, onClose, title, children }) {
    if (!open) return null
    return <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-dark-500"><h3 className="text-lg font-bold text-white">{title}</h3><button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button></div>
        <div className="p-5">{children}</div>
    </div></div>
}

function TeamForm({ initial, onSubmit, loading }) {
    const { data: usersData } = useQuery({ queryKey: ['users-all'], queryFn: () => getUsers({ limit: 200 }) })
    const tls = usersData?.data?.users || []
    const [form, setForm] = useState(initial || { name: '', description: '', teamLeads: [], color: '#6366f1' })
    const f = (k) => (v) => setForm((s) => ({ ...s, [k]: typeof v === 'object' ? v.target.value : v }))

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
            <div><label className="label">Team Name *</label><input className="input" value={form.name} onChange={f('name')} required /></div>
            <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={f('description')} /></div>
            <div>
                <label className="label">Team Leads</label>
                <div className="space-y-2 text-gray-300">
                    {(form.teamLeads || []).map((leadId, index) => (
                        <div key={index} className="flex gap-2">
                            <select
                                className="input flex-1"
                                value={leadId || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setForm((prev) => {
                                        const newLeads = [...(prev.teamLeads || [])];
                                        newLeads[index] = val;
                                        return { ...prev, teamLeads: newLeads };
                                    });
                                }}
                            >
                                <option value="">Select a leader</option>
                                {tls.map((u) => (
                                    <option key={u._id} value={u._id}>
                                        {u.name} ({u.email})
                                    </option>
                                ))}
                            </select>
                            <button type="button" onClick={() => {
                                setForm((prev) => ({
                                    ...prev,
                                    teamLeads: prev.teamLeads.filter((_, i) => i !== index)
                                }));
                            }} className="text-red-400 hover:text-red-300 px-2 text-lg font-bold">✕</button>
                        </div>
                    ))}
                    <button type="button" onClick={() => {
                        setForm((prev) => ({ ...prev, teamLeads: [...(prev.teamLeads || []), ''] }));
                    }} className="btn-secondary py-1.5 text-xs w-full justify-center">
                        ➕ Add Team Lead
                    </button>
                </div>
            </div>
            <div>
                <label className="label">Color</label>
                <div className="flex gap-2 flex-wrap mt-1">
                    {TEAM_COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => setForm((s) => ({ ...s, color: c }))}
                            className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                            style={{ background: c }} />
                    ))}
                </div>
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
                {loading ? '⏳ Saving...' : (initial ? '💾 Update Team' : '➕ Create Team')}
            </button>
        </form>
    )
}

export default function AdminTeams() {
    const qc = useQueryClient()
    const [modal, setModal] = useState(null)
    const { data, isLoading } = useQuery({ queryKey: ['teams'], queryFn: getTeams })
    const teams = data?.data?.teams || []

    const createMut = useMutation({ mutationFn: createTeam, onSuccess: () => { qc.invalidateQueries(['teams']); setModal(null); toast.success('Team created!') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })
    const updateMut = useMutation({ mutationFn: ({ id, ...d }) => updateTeam(id, d), onSuccess: () => { qc.invalidateQueries(['teams']); setModal(null); toast.success('Team updated!') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })
    const deleteMut = useMutation({ mutationFn: deleteTeam, onSuccess: () => { qc.invalidateQueries(['teams']); toast.success('Team deleted') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="page-title mb-0 text-xl sm:text-2xl">🏷️ Teams ({teams.length})</h1>
                <button onClick={() => setModal({ type: 'create' })} className="btn-primary w-full sm:w-auto justify-center">➕ Add Team</button>
            </div>

            {isLoading ? <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" /></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.map((team) => (
                        <div key={team._id} className="card-hover group">
                            <div className="flex items-start gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold" style={{ background: team.color }}>
                                    {team.name[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-white truncate">{team.name}</h3>
                                    <p className="text-xs text-gray-400 truncate">{team.description || 'No description'}</p>
                                </div>
                            </div>
                            {team.teamLeads && team.teamLeads.length > 0 && (
                                <div className="flex flex-col gap-1 mb-3 text-sm text-gray-300">
                                    {team.teamLeads.map((lead, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <span>👑</span><span>{lead.name} (TL {idx + 1})</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2 mt-3 pt-3 border-t border-dark-500">
                                <button onClick={() => setModal({ type: 'edit', team })} className="btn-secondary py-1.5 text-xs flex-1 justify-center">✏️ Edit</button>
                                <button onClick={() => { if (window.confirm('Delete this team?')) deleteMut.mutate(team._id) }} className="btn-danger py-1.5 text-xs px-3">🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal open={modal?.type === 'create'} onClose={() => setModal(null)} title="Create Team">
                <TeamForm onSubmit={createMut.mutate} loading={createMut.isPending} />
            </Modal>
            <Modal open={modal?.type === 'edit'} onClose={() => setModal(null)} title="Edit Team">
                {modal?.team && <TeamForm
                    initial={{ ...modal.team, teamLeads: modal.team.teamLeads?.map(l => typeof l === 'string' ? l : l._id) || [] }}
                    onSubmit={(d) => {
                        const { _id, createdAt, updatedAt, __v, ...rest } = d;
                        updateMut.mutate({ id: modal.team._id, ...rest });
                    }}
                    loading={updateMut.isPending}
                />}
            </Modal>
        </div>
    )
}