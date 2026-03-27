'use client'
import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { genId, exportCSV, exportPDF } from '../../lib/utils'
import { Briefcase, Plus, Search, Download, Trash2, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '../common/ConfirmModal'

export default function ProjectsPage() {
  const { projects, saveProjects, entries, settings, saveSettings, logAudit } = useApp()
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ name: '', active: true, budget: 0 })
  const [confirmDelete, setConfirmDelete] = useState<{isOpen: boolean, projectId: string, projectName: string}>({isOpen: false, projectId: '', projectName: ''})

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
    setForm({ name: '', active: true, budget: 0 })
  }

  const handleDelete = (id: string) => {
    const project = projects.find((p: any) => p.id === id)
    setConfirmDelete({isOpen: true, projectId: id, projectName: project?.name || ''})
  }

  const confirmDeleteProject = () => {
    const project = projects.find((p: any) => p.id === confirmDelete.projectId)
    saveProjects(projects.filter((p: any) => p.id !== confirmDelete.projectId))
    if (project) logAudit('project_delete', confirmDelete.projectId, { name: project.name })
    toast.success('Project removed')
  }

  const handleExport = (format: 'csv' | 'pdf') => {
    const data = projectStats.map(p => ({
      Project: p.name,
      Status: p.active ? 'Active' : 'Inactive',
      Budget: p.budget || 0,
      TotalHours: p.totalHours,
      StaffCount: p.staffCount
    }))

    if (format === 'csv') {
      exportCSV(data, 'projects_report.csv')
    } else {
      const cols = [
        { key: 'Project', label: 'Project Name' },
        { key: 'Status', label: 'Status' },
        { key: 'Budget', label: 'Budget' },
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
    input.accept = '.csv'
    input.onchange = (e: any) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const text = evt.target?.result as string
          const lines = text.split('\n').filter(r => r.trim())
          if (lines.length === 0) {
            toast.error('Empty CSV file')
            return
          }

          // Parse header row
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

          // Parse data rows
          const newProjects = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
            const projectName = values[headers.indexOf('ProjectName')] || values[headers.indexOf('Project Name')] || values[headers.indexOf('Project')] || values[0]

            if (!projectName || !projectName.trim()) return null

            // Check for duplicates
            if (projects.some((p: any) => p.name.toLowerCase() === projectName.toLowerCase())) {
              return null
            }

            return {
              id: genId(),
              name: projectName.trim(),
              active: true,
              budget: 0
            }
          }).filter(Boolean)

          if (newProjects.length === 0) {
            toast.error('No valid projects found or all are duplicates')
            return
          }

          saveProjects([...projects, ...newProjects])
          logAudit('project_bulk_import', 'bulk', { count: newProjects.length, projects: newProjects.map((p: any) => p.name) })
          toast.success(`Imported ${newProjects.length} projects`)
        } catch (error) {
          toast.error('Failed to parse CSV file')
          console.error('Import error:', error)
        }
      }
      reader.readAsText(file)
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleImport}>
            📁 Import CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => exportCSV([{ ProjectName: 'Project X' }, { ProjectName: 'Project Y' }], 'projects_template.csv')}>
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
                <th>Project Name</th>
                <th>Status</th>
                <th>Budget (h)</th>
                <th>Total Hours</th>
                <th>Staff Contributors</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projectStats.map((p: any) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700 }}>{p.name}</td>
                  <td>
                    <span className={`badge badge-${p.active ? 'green' : 'gray'}`}>
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{p.budget || 0}h</td>
                  <td style={{ fontWeight: 800, color: 'var(--accent)' }}>{p.totalHours.toLocaleString()}h</td>
                  <td>{p.staffCount}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-icon btn-secondary btn-sm" title="Edit" onClick={() => { setEditing(p); setForm({ name: p.name, active: p.active, budget: p.budget || 0 }); setShowAdd(true) }}>
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
                   <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>No projects found</td>
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
              <div className="form-group">
                <label className="form-label">Budget Hours</label>
                <input className="form-input" type="number" value={form.budget} onChange={e => setForm({ ...form, budget: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} id="p-active" />
                <label htmlFor="p-active" style={{ fontSize: 13, fontWeight: 600 }}>Active Project</label>
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
    </div>
  )
}
