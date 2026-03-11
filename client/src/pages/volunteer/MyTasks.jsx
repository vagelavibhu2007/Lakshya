import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTasks } from '../../api'
import { useNavigate } from 'react-router-dom'

const STATUS_MAP = { open: { label: 'Open', class: 'badge-primary' }, submitted: { label: 'Submitted', class: 'badge-warning' }, verified: { label: 'Verified', class: 'badge-success' }, rejected: { label: 'Rejected', class: 'badge-danger' } }
const PRIORITY_MAP = { low: '🔵', medium: '🟡', high: '🟠', urgent: '🔴' }

export default function MyTasks() {
    const navigate = useNavigate()
    const [filter, setFilter] = useState('')
    const { data, isLoading } = useQuery({
        queryKey: ['my-tasks', filter],
        queryFn: () => getTasks({ status: filter, limit: 30 }),
    })
    const tasks = data?.data?.tasks || []

    return (
        <div className="space-y-5 animate-fade-in">
            <h1 className="page-title">✅ My Tasks</h1>
            <div className="flex gap-2 flex-wrap">
                {['', 'open', 'submitted', 'verified', 'rejected'].map((s) => (
                    <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${filter === s ? 'bg-primary-500 border-primary-500 text-white' : 'bg-dark-700 border-dark-500 text-gray-400'}`}>
                        {s ? STATUS_MAP[s]?.label : '🔄 All'}
                    </button>
                ))}
            </div>

            {isLoading ? <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" /></div> : (
                <div className="space-y-3">
                    {tasks.map((task) => (
                        <div key={task._id} className="card-hover">
                            <div className="flex items-start gap-3">
                                <span className="text-xl mt-0.5">{PRIORITY_MAP[task.priority] || '⚪'}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <h3 className="font-bold text-white">{task.title}</h3>
                                        <span className={STATUS_MAP[task.status]?.class}>{STATUS_MAP[task.status]?.label}</span>
                                        <span className="badge-primary">{task.basePoints} pts</span>
                                    </div>
                                    <p className="text-sm text-gray-400 mb-2 line-clamp-2">{task.description}</p>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span>🏷️ {task.teamId?.name}</span>
                                        {task.deadline && <span>⏰ Due {new Date(task.deadline).toLocaleDateString()}</span>}
                                    </div>
                                </div>
                                {task.status !== 'verified' && (
                                    <button onClick={() => navigate(`/vol/submit/${task._id}`)} className="btn-primary py-1.5 text-sm flex-shrink-0">
                                        📤 Submit / Edit
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {tasks.length === 0 && <div className="card text-center text-gray-500 py-10">No tasks assigned to you{filter ? ` with status "${filter}"` : ''}</div>}
                </div>
            )}
        </div>
    )
}