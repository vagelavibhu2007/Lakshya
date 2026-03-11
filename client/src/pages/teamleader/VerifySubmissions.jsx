import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSubmissions, verifySubmission } from '../../api'
import toast from 'react-hot-toast'

function Modal({ open, onClose, title, children }) {
    if (!open) return null
    return <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-dark-500"><h3 className="text-lg font-bold text-white">{title}</h3><button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button></div>
        <div className="p-5">{children}</div>
    </div></div>
}

export default function VerifySubmissions() {
    const qc = useQueryClient()
    const [modal, setModal] = useState(null)
    const [filter, setFilter] = useState('pending')

    const { data, isLoading } = useQuery({
        queryKey: ['submissions', filter],
        queryFn: () => getSubmissions({ status: filter, limit: 30 }),
    })
    const submissions = data?.data?.submissions || []

    const verifyMut = useMutation({
        mutationFn: ({ id, ...d }) => verifySubmission(id, d),
        onSuccess: () => { qc.invalidateQueries(['submissions']); qc.invalidateQueries(['tasks']); qc.invalidateQueries(['dashboard']); setModal(null); toast.success('Submission processed!') },
        onError: (e) => toast.error(e.response?.data?.message || 'Error'),
    })

    const [verifyForm, setVerifyForm] = useState({ awardedPoints: 0, status: 'verified', rejectionReason: '' })

    return (
        <div className="space-y-5 animate-fade-in">
            <h1 className="page-title">✔️ Verify Submissions</h1>

            <div className="flex gap-2 flex-wrap">
                {['pending', 'verified', 'rejected'].map((s) => (
                    <button key={s} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all flex-1 sm:flex-none ${filter === s ? 'bg-primary-500 border-primary-500 text-white' : 'bg-dark-700 border-dark-500 text-gray-400'}`}>
                        {s === 'pending' ? '⏳' : s === 'verified' ? '✅' : '❌'} {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                ))}
            </div>


            {isLoading ? <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" /></div> : (
                <div className="space-y-3">
                    {submissions.map((sub) => (
                        <div key={sub._id} className={`card border-l-4 ${sub.status === 'verified' ? 'border-l-emerald-500' : sub.status === 'rejected' ? 'border-l-red-500' : 'border-l-yellow-500'}`}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <h3 className="font-bold text-white mb-1">{sub.taskId?.title || 'Unknown task'}</h3>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400 mb-2">
                                        <span>👤 <span className="text-gray-200">{sub.submittedBy?.name}</span></span>
                                        {sub.taskId?.teamId?.name && <span>🏷️ {sub.taskId.teamId.name}</span>}
                                        <span>🗂️ {sub.proofType}</span>
                                        <span>📅 {new Date(sub.createdAt).toLocaleString()}</span>
                                    </div>
                                    {/* Status badges */}
                                    {sub.status === 'verified' && (
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="badge-success text-xs">✅ Verified — {sub.awardedPoints} pts awarded</span>
                                            {sub.verifiedBy?.name && <span className="text-xs text-gray-500">by {sub.verifiedBy.name}</span>}
                                            {sub.verifiedAt && <span className="text-xs text-gray-500">on {new Date(sub.verifiedAt).toLocaleDateString()}</span>}
                                        </div>
                                    )}
                                    {sub.status === 'rejected' && (
                                        <div className="mb-2">
                                            <span className="badge-danger text-xs">❌ Rejected</span>
                                            {sub.verifiedBy?.name && <span className="text-xs text-gray-500 ml-2">by {sub.verifiedBy.name}</span>}
                                            {sub.rejectionReason && <p className="text-xs text-red-400 mt-1 bg-red-900/20 px-2 py-1 rounded border border-red-500/20 inline-block">{sub.rejectionReason}</p>}
                                        </div>
                                    )}
                                    {sub.status === 'pending' && <span className="badge-warning text-xs mb-2 inline-block">⏳ Pending Review</span>}
                                    {sub.note && <p className="text-sm text-gray-300 italic mb-2">"{sub.note}"</p>}
                                    <div className="flex gap-2 mt-1">
                                        {sub.proofType === 'link' && (<a href={sub.proofValue} target="_blank" rel="noreferrer" className="btn-secondary py-1 px-3 text-xs">🔗 View Link</a>)}
                                        {sub.proofType === 'file' && (<a href={sub.proofValue} target="_blank" rel="noreferrer" className="btn-secondary py-1 px-3 text-xs">📄 View File</a>)}
                                        {sub.proofType === 'text' && (<div className="text-sm text-gray-300 bg-dark-700 rounded-lg p-3 border border-dark-500 w-full">{sub.proofValue}</div>)}
                                    </div>
                                </div>
                                {sub.status === 'pending' && (
                                    <button
                                        onClick={() => { setModal(sub); setVerifyForm({ awardedPoints: sub.taskId?.basePoints || 10, status: 'verified', rejectionReason: '' }) }}
                                        className="btn-primary py-2 px-3 text-sm flex-shrink-0"
                                    >
                                        ✔️ Review
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {submissions.length === 0 && <div className="card text-center text-gray-500 py-10">No {filter} submissions</div>}
                </div>
            )}

            <Modal open={!!modal} onClose={() => setModal(null)} title="Review Submission">
                {modal && (
                    <div className="space-y-4">
                        <div className="p-3 rounded-lg bg-dark-700 border border-dark-500">
                            <p className="text-sm font-medium text-white mb-1">{modal.taskId?.title}</p>
                            <p className="text-xs text-gray-400">Submitted by {modal.submittedBy?.name} · Base points: {modal.taskId?.basePoints}</p>
                        </div>
                        <div>
                            <label className="label">Decision</label>
                            <div className="flex gap-2">
                                <button onClick={() => setVerifyForm((f) => ({ ...f, status: 'verified' }))} className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${verifyForm.status === 'verified' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-dark-700 border-dark-500 text-gray-400'}`}>✅ Verify</button>
                                <button onClick={() => setVerifyForm((f) => ({ ...f, status: 'rejected' }))} className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${verifyForm.status === 'rejected' ? 'bg-red-600 border-red-500 text-white' : 'bg-dark-700 border-dark-500 text-gray-400'}`}>❌ Reject</button>
                            </div>
                        </div>
                        {verifyForm.status === 'verified' && (
                            <div>
                                <label className="label">Points to Award</label>
                                <input type="number" className="input" min={0} value={verifyForm.awardedPoints} onChange={(e) => setVerifyForm((f) => ({ ...f, awardedPoints: Number(e.target.value) }))} />
                            </div>
                        )}
                        {verifyForm.status === 'rejected' && (
                            <div>
                                <label className="label">Rejection Reason</label>
                                <textarea className="input" rows={2} value={verifyForm.rejectionReason} onChange={(e) => setVerifyForm((f) => ({ ...f, rejectionReason: e.target.value }))} />
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button className="btn-secondary flex-1 justify-center" onClick={() => setModal(null)}>Cancel</button>
                            <button
                                className={`flex-1 justify-center ${verifyForm.status === 'verified' ? 'btn-success' : 'btn-danger'}`}
                                onClick={() => verifyMut.mutate({ id: modal._id, ...verifyForm })}
                                disabled={verifyMut.isPending}
                            >
                                {verifyMut.isPending ? '⏳...' : (verifyForm.status === 'verified' ? '✅ Confirm Verify' : '❌ Confirm Reject')}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}