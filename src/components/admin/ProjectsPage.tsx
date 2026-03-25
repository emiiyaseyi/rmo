'use client'
import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { genId, exportCSV, exportPDF } from '../../lib/utils'
import { Briefcase, Plus, Search, Download, Trash2, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProjectsPage() {
  const { projects, saveProjects, entries } = useApp()
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ name: '', active: true, budget: 0 })

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
      toast.success('Project updated')
    } else {
      const newP = { ...form, id: genId() }
      saveProjects([...projects, newP])
      toast.success('Project added')
    }
    setShowAdd(false)
    setEditing(null)
    setForm({ name: '', active: true, budget: 0 })
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Are you sure? This will not delete historical logs but will remove it from the active projects list.')) return
    saveProjects(projects.filter((p: any) => p.id !== id))
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>💼 Project Management</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>Manaage projects and view total logged hours</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('csv')}>
            <Download size={14} /> CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')}>
            <Download size={14} /> PDF
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
                      <button className="btn btn-icon btn-secondary btn-sm" onClick={() => { setEditing(p); setForm({ name: p.name, active: p.active, budget: p.budget || 0 }); setShowAdd(true) }}>
                        <Edit2 size={12} />
                      </button>
                      <button className="btn btn-icon btn-danger btn-sm" onClick={() => handleDelete(p.id)}>
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
    </div>
  )
}
