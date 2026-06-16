'use client'
import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { genId, exportCSV, exportPDF, avatarColor, initials } from '../../lib/utils'
import { Plus, Search, Download, Trash2, Pencil, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'

export default function ProjectsPage() {
  const { projects, saveProjects, entries, settings, saveSettings, logAudit } = useApp()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<{ name: string; active: boolean; budget: number; tasks: string[] }>({ name: '', active: true, budget: 0, tasks: [] })
  const [taskInput, setTaskInput] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{isOpen: boolean, projectId: string, projectName: string}>({isOpen: false, projectId: '', projectName: ''})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  const saveAllSettings = (updates: any) => {
    const newData = { ...settings, ...updates }
    saveSettings(newData)
    logAudit('settings_change', 'system', { updates: Object.keys(updates) })
  }

  // Search-filtered list (used for filter-pill counts)
  const searchedStats = useMemo(() => {
    return projects.map((p: any) => {
      const pEntries = entries.filter(e => e.project === p.name && !e.deleted)
      const totalHours = pEntries.reduce((sum, e) => sum + (e.hours || 0), 0)
      const staffCount = new Set(pEntries.map(e => e.staffId)).size
      const contributors = Array.from(new Set(pEntries.map(e => e.staffName).filter(Boolean)))
      return { ...p, totalHours, staffCount, contributors }
    }).filter((p: any) =>
      !search || p.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [projects, entries, search])

  const filterCounts = useMemo(() => ({
    all: searchedStats.length,
    active: searchedStats.filter((p: any) => p.active).length,
    inactive: searchedStats.filter((p: any) => !p.active).length,
  }), [searchedStats])

  // Status-filtered list (the projects actually shown / exported)
  const projectStats = useMemo(() => {
    if (statusFilter === 'active') return searchedStats.filter((p: any) => p.active)
    if (statusFilter === 'inactive') return searchedStats.filter((p: any) => !p.active)
    return searchedStats
  }, [searchedStats, statusFilter])

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('Project name required')
      return
    }

    const nameLower = form.name.trim().toLowerCase()
    const duplicate = projects.find((p: any) =>
      p.name.trim().toLowerCase() === nameLower && (!editing || p.id !== editing.id)
    )
    if (duplicate) {
      toast.error(`A project named "${duplicate.name}" already exists`)
      return
    }

    if (editing) {
      saveProjects(projects.map((p: any) => p.id === editing.id ? { ...p, ...form } : p))
      logAudit('project_update', editing.id, { name: form.name, active: form.active, budget: form.budget })
      toast.success('Project updated')
    } else {
      const newP = { ...form, id: genId() }
      saveProjects([...projects, newP])
      logAudit('project_create', newP.id, { name: form.name, active: form.active, budget: form.budget })
      toast.success('Project added')
    }
    setShowAdd(false)
    setEditing(null)
    setForm({ name: '', active: true, budget: 0, tasks: [] })
    setTaskInput('')
  }

  const handleDelete = (id: string) => {
    const project = projects.find((p: any) => p.id === id)
    setConfirmDelete({isOpen: true, projectId: id, projectName: project?.name || ''})
  }

  const confirmDeleteProject = () => {
    const project = projects.find((p: any) => p.id === confirmDelete.projectId)
    saveProjects(projects.filter((p: any) => p.id !== confirmDelete.projectId))
    if (project) logAudit('project_delete', confirmDelete.projectId, { name: project.name })
    setConfirmDelete({ isOpen: false, projectId: '', projectName: '' })
    toast.success('Project removed')
  }

  const handleBulkDelete = () => {
    const names = projects.filter((p: any) => selected.has(p.id)).map((p: any) => p.name)
    saveProjects(projects.filter((p: any) => !selected.has(p.id)))
    logAudit('project_delete', 'bulk', { count: selected.size, names })
    toast.success(`${selected.size} project${selected.size > 1 ? 's' : ''} deleted`)
    setSelected(new Set())
    setConfirmBulkDelete(false)
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const allSelected = projectStats.length > 0 && projectStats.every((p: any) => selected.has(p.id))
  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(projectStats.map((p: any) => p.id)))
  }

  const handleExport = (format: 'csv' | 'pdf') => {
    const data = projectStats.map(p => ({
      Project: p.name,
      Status: p.active ? 'Active' : 'Inactive',
      Tasks: (p.tasks || []).join(', '),
      TotalHours: p.totalHours,
      StaffCount: p.staffCount
    }))

    if (format === 'csv') {
      exportCSV(data, 'projects_report.csv')
    } else {
      const cols = [
        { key: 'Project', label: 'Project Name' },
        { key: 'Status', label: 'Status' },
        { key: 'Tasks', label: 'Approved Tasks' },
        { key: 'TotalHours', label: 'Total Hours' },
        { key: 'StaffCount', label: 'Staff' }
      ]
      exportPDF(data, cols, 'Projects Time Report', 'projects_report.pdf')
    }
    toast.success('Exported')
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,.xlsx,.xls'
    input.onchange = async (e: any) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        const XLSX = await import('xlsx')
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        if (rows.length === 0) { toast.error('Empty file'); return }

        const getName = (r: any) =>
          r['Project Name'] || r['ProjectName'] || r['Project'] || r['project'] || Object.values(r)[0] as string

        const getTasks = (r: any): string[] => {
          const raw: string = r['Tasks'] || r['Task'] || r['Approved Tasks'] || ''
          return raw ? raw.split(',').map((t: string) => t.trim()).filter(Boolean) : []
        }

        let added = 0, updated = 0
        let updatedProjects = [...projects]
        for (const row of rows) {
          const name = String(getName(row) || '').trim()
          if (!name) continue
          const tasks = getTasks(row)
          const existing = updatedProjects.find((p: any) => p.name.toLowerCase() === name.toLowerCase())
          if (existing) {
            if (tasks.length > 0) {
              updatedProjects = updatedProjects.map((p: any) =>
                p.id === existing.id ? { ...p, tasks } : p
              )
              updated++
            }
          } else {
            updatedProjects.push({ id: genId(), name, active: true, budget: 0, tasks })
            added++
          }
        }

        if (added === 0 && updated === 0) { toast.error('No valid projects found'); return }

        saveProjects(updatedProjects)
        logAudit('project_bulk_import', 'bulk', { added, updated })
        const parts = []
        if (added > 0) parts.push(`${added} added`)
        if (updated > 0) parts.push(`${updated} updated`)
        toast.success(`Import complete: ${parts.join(', ')}`)
      } catch (error) {
        toast.error('Failed to parse file')
        console.error('Import error:', error)
      }
    }
    input.click()
  }

  const filterPills: { key: 'all' | 'active' | 'inactive'; label: string }[] = [
    { key: 'all', label: `All · ${filterCounts.all}` },
    { key: 'active', label: `Active · ${filterCounts.active}` },
    { key: 'inactive', label: `Inactive · ${filterCounts.inactive}` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-sora)', color: 'var(--ink)' }}>Project Management</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>Manage projects, import/export data and configure categories</p>
      </div>

      {/* Toolbar: filter pills + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {filterPills.map(pill => {
            const active = statusFilter === pill.key
            return (
              <button
                key={pill.key}
                onClick={() => setStatusFilter(pill.key)}
                style={{
                  background: active ? 'var(--brand)' : 'var(--elev)',
                  color: active ? '#fff' : 'var(--ink-2)',
                  border: 'none',
                  borderRadius: 999,
                  padding: '6px 13px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {pill.label}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {selected.size > 0 && (
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmBulkDelete(true)}>
              <Trash2 size={13} /> Delete {selected.size} selected
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handleImport}>
            📁 Import CSV/XLSX
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => exportCSV([
              { 'Project Name': '3MTT/DeepTech_Ready', Tasks: 'Meetings, Content Development, LMS/Student Management Assignments, Teaching Assistance, Social Media, Video Production, Stakeholder Management and Planning' },
              { 'Project Name': 'Administration', Tasks: 'Email Tracking and Response, Business Operational Reporting, Meetings, Business Operations, Employee Onboarding & Orientation, Event Planning & Management, Project Support' },
              { 'Project Name': 'New Project Example', Tasks: 'Task One, Task Two, Task Three' },
            ], 'projects_template.csv')}>
            📄 Template
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('csv')}>
            <Download size={14} /> Report CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')}>
            <Download size={14} /> Report PDF
          </button>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--brand)', color: '#fff', border: 'none',
              borderRadius: 'var(--r-sm)', padding: '9px 15px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(12,122,55,.25)',
            }}
          >
            <Plus size={15} /> New project
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 360 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)' }} />
        <input
          className="form-input"
          placeholder="Search projects…"
          style={{ paddingLeft: 34 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Select-all helper */}
      {projectStats.length > 0 && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', cursor: 'pointer' }}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          Select all ({projectStats.length})
        </label>
      )}

      {/* Project list / table */}
      {projectStats.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 40, textAlign: 'center', color: 'var(--ink-3)', boxShadow: 'var(--sh-sm)' }}>
          No projects found
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-sm)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              {(() => {
                const thStyle: React.CSSProperties = {
                  textAlign: 'left',
                  padding: '11px 16px',
                  color: 'var(--ink-4)',
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--line-2)',
                  whiteSpace: 'nowrap',
                }
                return (
                  <tr>
                    <th style={{ ...thStyle, width: 40, paddingRight: 0 }}>
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                    </th>
                    <th style={thStyle}>Project</th>
                    <th style={thStyle}>Contributors</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Budget used</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Hours</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                  </tr>
                )
              })()}
            </thead>
            <tbody>
              {projectStats.map((p: any) => {
                const budget = Number(p.budget) || 0
                const hasBudget = budget > 0
                const pct = hasBudget ? Math.round((p.totalHours / budget) * 100) : 0
                const over = hasBudget && p.totalHours > budget
                // status: inactive -> warn; over budget -> danger; otherwise on-track
                const status = !p.active
                  ? { label: 'Inactive', bg: 'var(--warn-tint)', color: 'var(--warn)' }
                  : over
                    ? { label: 'Over budget', bg: 'var(--danger-tint)', color: 'var(--danger)' }
                    : { label: 'On track', bg: 'var(--tint)', color: 'var(--brand-2)' }
                const barColor = over ? 'var(--danger)' : pct >= 80 ? 'var(--warn)' : 'var(--brand)'
                const contributors: string[] = p.contributors || []
                const isSel = selected.has(p.id)
                const tdStyle: React.CSSProperties = {
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--line-2)',
                  verticalAlign: 'middle',
                }
                return (
                  <tr
                    key={p.id}
                    style={{ background: isSel ? 'var(--tint)' : undefined, transition: 'background .12s' }}
                    onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--canvas)' }}
                    onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                  >
                    <td style={{ ...tdStyle, paddingRight: 0 }}>
                      <input type="checkbox" checked={isSel} onChange={() => toggleSelect(p.id)} />
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                        {p.tasks?.length > 0 ? `${p.tasks.length} approved task${p.tasks.length !== 1 ? 's' : ''}` : 'No approved tasks'}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {contributors.slice(0, 4).map((name, i) => (
                          <div
                            key={name}
                            title={name}
                            style={{
                              width: 26, height: 26, borderRadius: '50%',
                              background: avatarColor(name), color: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 700,
                              border: '2px solid var(--surface)',
                              marginLeft: i === 0 ? 0 : -8,
                            }}
                          >
                            {initials(name)}
                          </div>
                        ))}
                        {contributors.length > 4 && (
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--elev)', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, border: '2px solid var(--surface)', marginLeft: -8 }}>
                            +{contributors.length - 4}
                          </div>
                        )}
                        {contributors.length === 0 && (
                          <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>—</span>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-block', background: status.bg, color: status.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {status.label}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {hasBudget ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--line-2)', overflow: 'hidden', minWidth: 60 }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: barColor, borderRadius: 999 }} />
                          </div>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{pct}%</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>—</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{p.totalHours.toLocaleString()}h</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button className="btn btn-icon btn-secondary btn-sm" title="Edit" onClick={() => { setEditing(p); setForm({ name: p.name, active: p.active, budget: p.budget || 0, tasks: p.tasks || [] }); setTaskInput(''); setShowAdd(true) }}>
                          <Pencil size={12} />
                        </button>
                        <button className="btn btn-icon btn-danger btn-sm" title="Delete" onClick={() => handleDelete(p.id)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card flex flex-col gap-4">
        <h3 className="font-bold">🏷️ Entry Categories</h3>
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Configure tasks and categories available for time entry</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {settings?.categories.map((c: string) => (
            <div key={c} className="flex items-center gap-2 px-3 py-1.5 bg-soft-primary text-primary rounded-full text-xs font-medium">
              {c}
              <button className="hover:text-danger" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => {
                const next = settings.categories.filter((x: string) => x !== c)
                saveAllSettings({ categories: next })
              }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" className="form-input" style={{ maxWidth: 300 }} id="cat-name-input" placeholder="New Category Name" />
          <button 
            className="btn btn-secondary"
            onClick={() => {
              const el = document.getElementById('cat-name-input') as HTMLInputElement
              const name = el.value
              if (!name) return
              saveAllSettings({ categories: [...settings.categories, name] })
              el.value = ''
              toast.success('Category added')
            }}
          >Add Category</button>
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Edit Project' : 'Add New Project'}</span>
              <button className="btn btn-icon btn-secondary btn-sm" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Project X" />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} id="p-active" />
                <label htmlFor="p-active" style={{ fontSize: 13, fontWeight: 600 }}>Active Project</label>
              </div>
              <div className="form-group">
                <label className="form-label">Approved Tasks</label>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>Staff can only select from these tasks when logging hours for this project.</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {form.tasks.map((t, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--accent-subtle)', color: 'var(--accent)', borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                      {t}
                      <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'inherit' }} onClick={() => setForm({ ...form, tasks: form.tasks.filter((_, j) => j !== i) })}><X size={10} /></button>
                    </span>
                  ))}
                  {form.tasks.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No tasks yet</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="form-input"
                    placeholder="Add task name…"
                    value={taskInput}
                    onChange={e => setTaskInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault()
                        const t = taskInput.trim()
                        if (t && !form.tasks.includes(t)) setForm({ ...form, tasks: [...form.tasks, t] })
                        setTaskInput('')
                      }
                    }}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                    const t = taskInput.trim()
                    if (t && !form.tasks.includes(t)) setForm({ ...form, tasks: [...form.tasks, t] })
                    setTaskInput('')
                  }}>Add</button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save Project</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Delete Project"
        message={`Are you sure you want to delete "${confirmDelete.projectName}"?\n\nThis will not delete historical logs but will remove it from the active projects list.`}
        confirmText="Delete"
        confirmStyle="danger"
        onConfirm={confirmDeleteProject}
        onCancel={() => setConfirmDelete({isOpen: false, projectId: '', projectName: ''})}
      />
      <ConfirmModal
        isOpen={confirmBulkDelete}
        title={`Delete ${selected.size} Project${selected.size > 1 ? 's' : ''}`}
        message={`Are you sure you want to delete ${selected.size} selected project${selected.size > 1 ? 's' : ''}?\n\nThis will not delete historical logs but will remove them from the active projects list.`}
        confirmText={`Delete ${selected.size}`}
        confirmStyle="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </div>
  )
}
