'use client'
import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { genId, exportCSV, exportPDF } from '../../lib/utils'
import { Briefcase, Plus, Search, Download, Trash2, Edit2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'

export default function ProjectsPage() {
  const { projects, saveProjects, entries, settings, saveSettings, logAudit } = useApp()
  const [search, setSearch] = useState('')
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

  const projectStats = useMemo(() => {
    return projects.map((p: any) => {
      const pEntries = entries.filter(e => e.project === p.name && !e.deleted)
      const totalHours = pEntries.reduce((sum, e) => sum + (e.hours || 0), 0)
      const staffCount = new Set(pEntries.map(e => e.staffId)).size
      return { ...p, totalHours, staffCount }
    }).filter((p: any) => 
      !search || p.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [projects, entries, search])

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>💼 Project Management</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>Manage projects, import/export data and configure categories</p>
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
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add Project
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '16px', display: 'flex', gap: 12 }}>
         <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input 
              className="form-input" 
              placeholder="Filter projects..." 
              style={{ paddingLeft: 34 }} 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
         </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th>Project Name</th>
                <th>Status</th>
                <th>Approved Tasks</th>
                <th>Total Hours</th>
                <th>Staff Contributors</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projectStats.map((p: any) => (
                <tr key={p.id} style={{ background: selected.has(p.id) ? 'var(--accent-subtle)' : undefined }}>
                  <td>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                  </td>
                  <td style={{ fontWeight: 700 }}>{p.name}</td>
                  <td>
                    <span className={`badge badge-${p.active ? 'green' : 'gray'}`}>
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    {p.tasks?.length > 0
                      ? <span className="badge badge-blue">{p.tasks.length} task{p.tasks.length !== 1 ? 's' : ''}</span>
                      : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>}
                  </td>
                  <td style={{ fontWeight: 800, color: 'var(--accent)' }}>{p.totalHours.toLocaleString()}h</td>
                  <td>{p.staffCount}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-icon btn-secondary btn-sm" title="Edit" onClick={() => { setEditing(p); setForm({ name: p.name, active: p.active, budget: p.budget || 0, tasks: p.tasks || [] }); setTaskInput(''); setShowAdd(true) }}>
                        <Edit2 size={12} />
                      </button>
                      <button className="btn btn-icon btn-danger btn-sm" title="Delete" onClick={() => handleDelete(p.id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {projectStats.length === 0 && (
                <tr>
                   <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>No projects found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
