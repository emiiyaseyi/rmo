'use client'
import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { genId, getWeekKey, exportCSV, logAudit } from '../../lib/utils'
import { Upload, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Entry } from '../../types'
import toast from 'react-hot-toast'

const VALID_STATUSES = ['draft', 'submitted', 'approved', 'rejected'] as const;
type ValidStatus = typeof VALID_STATUSES[number];

interface ValidatedRow extends Partial<Entry> {
  _row: number;
  _status: 'ok' | 'warn' | 'err';
  _errors: string[];
  _warnings: string[];
  _staffId: string | null;
  _staffName: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  warnings: number;
  staffCount: number;
}

function StatusIcon({ status }: { status: 'ok' | 'warn' | 'err' }) {
  if (status === 'ok') return <CheckCircle size={14} color="var(--success)" />
  if (status === 'warn') return <AlertCircle size={14} color="var(--warning)" />
  if (status === 'err') return <XCircle size={14} color="var(--danger)" />
  return null
}

export default function BulkTimeEntryImport({ onClose }: { onClose: () => void }) {
  const { staff, entries, saveEntries, settings, user, notify } = useApp()
  const [step, setStep] = useState(1)   // 1=upload, 2=preview, 3=done
  const [validated, setValidated] = useState<ValidatedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const categories = settings?.categories || ['Client Work', 'Internal', 'Training', 'Admin', 'Business Development', 'Research']

  function downloadTemplate() {
    exportCSV([
      { 'Staff Name': 'Jane Doe', Email: 'jane.doe@datasciencenigeria.ai', Project: 'Project Alpha', Lead: 'John Manager', Description: 'Client kickoff meeting', 'Start Date': '13-01-25', 'End Date': '13-01-25', Hours: 3, Category: 'Client Work', Status: 'approved' },
      { 'Staff Name': 'Bob Smith', Email: 'bob.smith@datasciencenigeria.ai', Project: 'Internal Ops', Lead: 'Jane Doe', Description: 'Weekly team standup', 'Start Date': '13-01-25', 'End Date': '13-01-25', Hours: 1, Category: 'Internal', Status: 'submitted' },
    ], 'bulk_time_entry_template.csv')
    toast.success('Template downloaded')
  }

  function parseFile(file: File) {
    import('xlsx').then(XLSX => {
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          const content = ev.target?.result
          if (!content) return
          const wb = XLSX.read(content, { type: 'binary', cellDates: true })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const raw = XLSX.utils.sheet_to_json(ws) as any[]
          if (raw.length === 0) { toast.error('File is empty'); return }

          const now = new Date().toISOString()
          // Case-insensitive key lookup helper
          const getCol = (r: any, ...keys: string[]) => {
            const rKeys = Object.keys(r)
            for (const key of keys) {
              const match = rKeys.find(k => k.toLowerCase().trim() === key.toLowerCase())
              if (match && r[match] !== undefined && r[match] !== '') return r[match]
            }
            return ''
          }

          const enriched: ValidatedRow[] = raw.map((r, i) => {
            const errors: string[] = []
            const warnings: string[] = []

            const rawEmail = getCol(r, 'Email', 'email', 'Staff Email', 'staff_email')
            const rawName = getCol(r, 'Staff Name', 'staff_name', 'Name', 'name')
            const email = String(rawEmail).toLowerCase().trim()
            const staffName = String(rawName).trim()

            const matchedStaff = email
              ? staff.find(s => s.email?.toLowerCase() === email)
              : staffName
              ? staff.find(s => s.name?.toLowerCase() === staffName.toLowerCase())
              : null
            if (!email && !staffName) errors.push('Missing staff email or name')
            else if (!matchedStaff) errors.push(`No staff found: ${email || staffName}`)

            const project = String(getCol(r, 'Project', 'project')).trim()
            if (!project) errors.push('Missing project')

            const rawDate = getCol(r, 'Date', 'date', 'Start Date', 'start date', 'start_date')
            let dateStr = ''
            if (rawDate instanceof Date) {
              const d = rawDate
              dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            } else if (rawDate) {
              const s = String(rawDate).trim()
              // Handle DD-MM-YY or DD-MM-YYYY
              const dmyMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/)
              if (dmyMatch) {
                const [, dd, mm, yy] = dmyMatch
                const yyyy = yy.length === 2 ? `20${yy}` : yy
                dateStr = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
              } else {
                // YYYY-MM-DD or ISO-like
                dateStr = s.slice(0, 10)
              }
            }
            if (!dateStr) errors.push('Missing date')
            else if (isNaN(new Date(dateStr).getTime())) errors.push('Invalid date: ' + rawDate)

            const hours = parseFloat(String(getCol(r, 'Hours', 'hours') || '0'))
            if (!hours || hours <= 0) errors.push('Missing / zero hours')
            if (hours > 24) warnings.push('Hours > 24 — unusual')

            const statusInput = (String(getCol(r, 'Status', 'status') || 'draft')).toLowerCase().trim()
            const status = VALID_STATUSES.includes(statusInput as any) ? (statusInput as ValidStatus) : 'draft'
            if (!VALID_STATUSES.includes(statusInput as any)) warnings.push(`Unknown status "${statusInput}" — will use "draft"`)

            const isDuplicate = entries.some(e =>
              e.staffId === matchedStaff?.id &&
              e.date === dateStr &&
              e.project === project &&
              Math.abs((e.hours || 0) - hours) < 0.01 &&
              !e.deleted
            )
            if (isDuplicate) warnings.push('Possible duplicate entry')

            const parsedDate = dateStr ? new Date(dateStr) : null
            const weekKey = parsedDate && !isNaN(parsedDate.getTime()) ? getWeekKey(parsedDate) : ''

            return {
              _row: i + 2,
              _status: errors.length ? 'err' : warnings.length ? 'warn' : 'ok',
              _errors: errors,
              _warnings: warnings,
              _staffId: matchedStaff?.id || null,
              _staffName: matchedStaff?.name || email,
              id: genId(),
              staffId: matchedStaff?.id || '',
              staffName: matchedStaff?.name || email,
              project,
              lead: String(getCol(r, 'Lead', 'lead') || '').trim(),
              description: String(getCol(r, 'Description', 'description') || '').trim(),
              date: dateStr,
              hours,
              category: String(getCol(r, 'Category', 'category') || categories[0]).trim(),
              status,
              weekKey,
              createdAt: now,
              updatedAt: now,
              adminImported: true,
              importedBy: user?.name,
            } as ValidatedRow
          })

          setValidated(enriched)
          setStep(2)
        } catch (err) {
          console.error(err)
          toast.error('Failed to parse file. Check format and try again.')
        }
      }
      reader.readAsBinaryString(file)
    })
  }

  function handleFile(file: File | undefined) {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!['csv', 'xlsx', 'xls'].includes(ext)) { toast.error('Only CSV or Excel files accepted'); return }
    parseFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  async function runImport(skipErrors = true) {
    const toImport = validated.filter(r => skipErrors ? r._status !== 'err' : true)
    if (toImport.length === 0) { toast.error('No valid rows to import'); return }
    setImporting(true)

    const clean: Entry[] = toImport.map(r => {
      const { _row, _status, _errors, _warnings, _staffId, _staffName, ...entry } = r
      return entry as Entry
    })

    const updated = [...entries, ...clean]
    saveEntries(updated)

    const affected = Array.from(new Set(clean.filter(r => r.staffId).map(r => r.staffId)))
    affected.forEach(sid => {
      const count = clean.filter(r => r.staffId === sid).length
      notify(sid, `📥 Admin imported ${count} time ${count === 1 ? 'entry' : 'entries'} to your timesheet`, 'info')
    })

    if (user) {
      logAudit('BULK_IMPORT_ENTRIES',
        `${user.name} bulk imported ${clean.length} time entries for ${affected.length} staff`,
        user.id, user.name
      )
    }

    const errCount = validated.filter(r => r._status === 'err').length
    const winCount = validated.filter(r => r._status === 'warn').length

    setResult({
      imported: clean.length,
      skipped: errCount,
      warnings: winCount,
      staffCount: affected.length,
    })
    setImporting(false)
    setStep(3)
  }

  const okCount = validated.filter(r => r._status === 'ok').length
  const warnCount = validated.filter(r => r._status === 'warn').length
  const errCount = validated.filter(r => r._status === 'err').length

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl" style={{ maxHeight: '90vh' }}>
        <div className="modal-header">
          <div>
            <span className="modal-title">📥 Bulk Time Entry Import</span>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              Import entries for any staff — updates dashboards, reports & profiles instantly
            </div>
          </div>
          <button className="btn btn-icon btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, alignItems: 'center' }}>
          {['Upload File', 'Review & Validate', 'Done'].map((label, i) => (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: step > i + 1 ? 'var(--success)' : step === i + 1 ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: step >= i + 1 ? 'white' : 'var(--text-3)',
                }}>
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: step === i + 1 ? 'var(--text-1)' : 'var(--text-3)' }}>{label}</span>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 1, background: step > i + 1 ? 'var(--success)' : 'var(--border)' }} />}
            </React.Fragment>
          ))}
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>📄 Required columns</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                    <strong>Required:</strong> Email, Project, Start Date, Hours
                    <br />
                    <strong>Optional:</strong> Staff Name, Lead, End Date, Description, Category, Status (draft / submitted / approved / rejected)
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
                  <Download size={13} /> Download Template
                </button>
              </div>

              <label
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 12, padding: 48, textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                  transition: 'all 0.2s',
                }}
              >
                <Upload size={36} color={dragOver ? 'var(--accent)' : 'var(--text-3)'} style={{ margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: dragOver ? 'var(--accent)' : 'var(--text-1)' }}>
                  Drop your file here or click to browse
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Supports .csv, .xlsx, .xls</div>
                <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
              </label>

              <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--accent)', marginBottom: 6 }}>💡 Tips</div>
                <ul style={{ fontSize: 12, color: 'var(--text-2)', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li>Staff are matched by <strong>Email</strong> column (preferred), or by <strong>Staff Name</strong> if email is absent</li>
                  <li>Dates can be <strong>DD-MM-YY</strong> (e.g. 25-02-26) or <strong>YYYY-MM-DD</strong> — both accepted</li>
                  <li>Set Status to <strong>approved</strong> to populate analytics immediately</li>
                  <li>Set Status to <strong>submitted</strong> for entries that still need team lead approval</li>
                  <li>Duplicate entries (same staff + date + project + hours) will be flagged</li>
                  <li>After import, all affected staff dashboards and reports update instantly</li>
                </ul>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 16px', flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>{okCount}</div>
                  <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>Ready to import</div>
                </div>
                <div style={{ background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 16px', flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--warning)' }}>{warnCount}</div>
                  <div style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600 }}>Warnings (will import)</div>
                </div>
                <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 16px', flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--danger)' }}>{errCount}</div>
                  <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>Errors (will skip)</div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{validated.length}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>Total rows</div>
                </div>
              </div>

              {errCount > 0 && (
                <div style={{ background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--warning)' }}>
                  ⚠️ {errCount} rows have errors and will be skipped. Fix them in your file and re-upload, or proceed to import {okCount + warnCount} valid rows.
                </div>
              )}

              <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Row</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Status</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Staff</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Project</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Date</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Hours</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Entry Status</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validated.map((r, i) => (
                      <tr key={i} style={{ background: r._status === 'err' ? 'rgba(239,68,68,0.04)' : r._status === 'warn' ? 'rgba(245,158,11,0.04)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{r._row}</td>
                        <td style={{ padding: '8px 12px' }}><StatusIcon status={r._status} /></td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-1)' }}>{r._staffName}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-2)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.project}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{r.date}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-1)' }}>{r.hours}h</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span className={`badge badge-${r.status === 'approved' ? 'green' : r.status === 'submitted' ? 'blue' : r.status === 'rejected' ? 'red' : 'gray'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11 }}>
                          {r._errors.map((e, j) => <div key={j} style={{ color: 'var(--danger)' }}>✕ {e}</div>)}
                          {r._warnings.map((w, j) => <div key={j} style={{ color: 'var(--warning)' }}>⚠ {w}</div>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => { setStep(1); setValidated([]) }}>← Re-upload</button>
                <div style={{ display: 'flex', gap: 10 }}>
                  {errCount > 0 && okCount + warnCount > 0 && (
                    <button className="btn btn-warning" disabled={importing} onClick={() => runImport(true)}
                      style={{ background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.3)' }}>
                      Import {okCount + warnCount} valid rows (skip {errCount} errors)
                    </button>
                  )}
                  <button
                    className="btn btn-primary"
                    disabled={importing || (okCount + warnCount === 0)}
                    onClick={() => runImport(true)}
                  >
                    {importing ? '⏳ Importing…' : `✅ Import ${okCount + warnCount} rows`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && result && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Import Complete!</h2>
              <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 24 }}>
                All affected staff dashboards, analytics and reports have been updated.
              </p>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
                {[
                  ['Entries Imported', result.imported, 'var(--success)'],
                  ['Staff Affected', result.staffCount, 'var(--accent)'],
                  ['Skipped (errors)', result.skipped, 'var(--danger)'],
                  ['Warnings', result.warnings, 'var(--warning)'],
                ].map(([label, val, color]) => (
                  <div key={label as string} style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '16px 20px', minWidth: 120 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: color as string }}>{val}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => { setStep(1); setValidated([]); setResult(null) }}>Import More</button>
                <button className="btn btn-primary" onClick={onClose}>Done</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
