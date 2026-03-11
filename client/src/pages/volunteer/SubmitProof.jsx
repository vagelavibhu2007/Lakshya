import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getTask, submitProof, submitFileProof } from '../../api'
import toast from 'react-hot-toast'

export default function SubmitProof() {
    const { taskId } = useParams()
    const navigate = useNavigate()
    const [proofType, setProofType] = useState('link')
    const [proofValue, setProofValue] = useState('')
    const [note, setNote] = useState('')
    const [file, setFile] = useState(null)

    const { data } = useQuery({ queryKey: ['task', taskId], queryFn: () => getTask(taskId) })
    const task = data?.data?.task

    const submitMut = useMutation({
        mutationFn: (payload) => {
            if (proofType === 'file') {
                const fd = new FormData()
                fd.append('proof', file)
                fd.append('note', note)
                return submitFileProof(taskId, fd)
            }
            return submitProof(taskId, payload)
        },
        onSuccess: () => { toast.success('Proof submitted! Awaiting verification.'); navigate('/vol/tasks') },
        onError: (e) => toast.error(e.response?.data?.message || 'Error submitting'),
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        if (proofType === 'file' && !file) { toast.error('Please select a file'); return }
        submitMut.mutate({ proofType, proofValue, note })
    }

    return (
        <div className="max-w-xl animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate(-1)} className="btn-secondary py-1.5 px-3 text-sm">← Back</button>
                <h1 className="text-xl font-bold text-white">📤 Submit Proof</h1>
            </div>

            {task && (
                <div className="card mb-5 border-l-4 border-l-primary-500">
                    <h3 className="font-bold text-white mb-1">{task.title}</h3>
                    <p className="text-sm text-gray-400">{task.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
                        <span>⭐ {task.basePoints} base points</span>
                        {task.deadline && <span>⏰ Due {new Date(task.deadline).toLocaleDateString()}</span>}
                    </div>
                </div>
            )}

            <div className="card">
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="label">Proof Type</label>
                        <div className="flex gap-2">
                            {[['link', '🔗 Link'], ['file', '📄 File'], ['text', '📝 Text']].map(([t, l]) => (
                                <button key={t} type="button" onClick={() => setProofType(t)} className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${proofType === t ? 'bg-primary-500 border-primary-500 text-white' : 'bg-dark-700 border-dark-500 text-gray-400'}`}>{l}</button>
                            ))}
                        </div>
                    </div>

                    {proofType === 'link' && (
                        <div>
                            <label className="label">URL *</label>
                            <input type="url" className="input" placeholder="https://..." value={proofValue} onChange={(e) => setProofValue(e.target.value)} required />
                        </div>
                    )}

                    {proofType === 'file' && (
                        <div>
                            <label className="label">Upload File * (PDF, DOC, Image — max 10MB)</label>
                            <input type="file" className="input py-2" onChange={(e) => setFile(e.target.files[0])} accept=".pdf,.csv,.docx,.doc,.jpg,.jpeg,.png,.gif,.webp,.txt" required />
                            {file && <p className="text-xs text-gray-400 mt-1">📄 {file.name}</p>}
                        </div>
                    )}

                    {proofType === 'text' && (
                        <div>
                            <label className="label">Text / Description *</label>
                            <textarea className="input" rows={5} placeholder="Describe your work or paste your content here..." value={proofValue} onChange={(e) => setProofValue(e.target.value)} required />
                        </div>
                    )}

                    <div>
                        <label className="label">Additional Note (optional)</label>
                        <textarea className="input" rows={2} placeholder="Anything you want to add for the reviewer..." value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>

            <div className="flex flex-col gap-2">
                <button type="submit" className="btn-primary w-full justify-center" disabled={submitMut.isPending}>
                    {submitMut.isPending ? '⏳ Submitting...' : '🚀 Submit / Edit for Review'}
                </button>
                <p className="text-xs text-center text-gray-500 mt-2">Uploading new proof will overwrite your previous pending submission.</p>
            </div>
                </form>
            </div>
        </div>
    )
}