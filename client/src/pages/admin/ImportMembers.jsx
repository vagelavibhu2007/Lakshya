import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { importMembersExcel } from '../../api'

function SummaryCard({ label, value, className }) {
  return (
    <div className={`card p-4 ${className || ''}`}>
      <div className="text-sm text-gray-400">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
    </div>
  )
}

export default function AdminImportMembers() {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)

  const importMut = useMutation({
    mutationFn: (f) => {
      const formData = new FormData()
      formData.append('file', f)
      return importMembersExcel(formData)
    },
    onSuccess: (res) => {
      setResult(res?.data || null)
      toast.success('Import completed')
    },
    onError: (e) => {
      toast.error(e.response?.data?.message || 'Import failed')
    },
  })

  const total = result?.totalRecords ?? 0
  const ok = result?.successfullyAdded ?? 0
  const failed = result?.failedCount ?? 0
  const failedEntries = result?.failedEntries || []

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="page-title mb-0">📥 Import Members (Excel)</h1>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <div className="text-white font-semibold">Upload file</div>
          <p className="text-sm text-gray-400 mt-1">
            Upload an <span className="text-gray-200">.xlsx</span> or{' '}
            <span className="text-gray-200">.csv</span> file with columns:{' '}
            <span className="text-gray-200">Full Name, Email, Phone, Team Name</span> and optional{' '}
            <span className="text-gray-200">Role</span> (
            <code className="text-gray-300">Admin</code>,{' '}
            <code className="text-gray-300">Team Leader</code>,{' '}
            <code className="text-gray-300">Faculty</code>,{' '}
            <code className="text-gray-300">Member</code>,{' '}
            <code className="text-gray-300">CA</code> /{' '}
            <code className="text-gray-300">Campus Ambassador</code> — or left blank) and optional{' '}
            <span className="text-gray-200">Password</span>.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Note: Blank or <code>Member</code> role →{' '}
            <span className="text-gray-200">Member</span>.{' '}
            <code>CA</code> / <code>Campus Ambassador</code> →{' '}
            <span className="text-gray-200">Campus Ambassador</span>. Duplicate
            emails are skipped. Missing teams are created automatically.
            If <code>Password</code> column is provided it will be used directly; otherwise a secure password is auto-generated.
            <strong className="text-amber-400"> IMPORTANT: Campus Ambassadors MUST be assigned to the "Marketing" team.</strong>
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="input max-w-md"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button
            className="btn-primary"
            disabled={!file || importMut.isPending}
            onClick={() => {
              if (!file) return toast.error('Please select a file')
              setResult(null)
              importMut.mutate(file)
            }}
          >
            {importMut.isPending ? '⏳ Importing...' : '⬆️ Upload & Import'}
          </button>
          {file && <span className="text-sm text-gray-400">Selected: {file.name}</span>}
        </div>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SummaryCard label="Total records" value={total} />
            <SummaryCard label="Successfully added" value={ok} className="border border-emerald-500/30" />
            <SummaryCard label="Failed / Skipped" value={failed} className="border border-red-500/30" />
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-white">Failed entries</h2>
              <div className="text-sm text-gray-400">{failedEntries.length} rows</div>
            </div>

            {failedEntries.length === 0 ? (
              <div className="text-gray-500 mt-4">No failures.</div>
            ) : (
              <div className="table-wrapper mt-4">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Email</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedEntries.map((f, idx) => (
                      <tr key={`${f.row || 'na'}-${f.email || 'na'}-${idx}`}>
                        <td className="text-gray-300">{f.row ?? '—'}</td>
                        <td className="text-gray-300">{f.email || '—'}</td>
                        <td className="text-gray-400">{f.reason || 'Unknown error'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}