'use client'
import React, { useState, useMemo } from 'react'
import { Staff, Entry } from '../../types'
import { exportCSV, exportPDF, fmtDate } from '../../lib/utils'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import BulkTimeEntryImport from '../settings/BulkTimeEntryImport'

interface TimeReportProps {
  entries: Entry[];
  staff: Staff[];
  projects: any[];
  dateRange: { start: Date; end: Date };
}

export default function TimeReport({ entries, staff, projects, dateRange }: TimeReportProps) {
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [projFilter, setProjFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showImport, setShowImport] = useState(false)

  const departments = Array.from(new Set(staff.map(s => s.department).filter(Boolean))).sort()
  const projectNames = Array.from(new Set(projects.map(p => p.name))).sort()

  const filtered = useMemo(() => {
    return entries.filter(e => {
      const s = staff.find(st => st.id === e.staffId)
      const matchesSearch = !search || s?.name.toLowerCase().includes(search.toLowerCase()) || e.description?.toLowerCase().includes(search.toLowerCase())
      const matchesDept = !deptFilter || s?.department === deptFilter
      const matchesProj = !projFilter || e.project === projFilter
      const matchesStatus = !statusFilter || e.status === statusFilter
      return matchesSearch && matchesDept && matchesProj && matchesStatus
    })
  }, [entries, staff, search, deptFilter, projFilter, statusFilter])

  const exportXLSX = () => {
    const data = filtered.map(e => ({
      Date: e.date,
      Staff: e.staffName,
      Department: staff.find(s => s.id === e.staffId)?.department || '—',
      Project: e.project,
      Category: e.category,
      Hours: e.hours,
      Status: e.status,
      Description: e.description
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Time Report")
    XLSX.writeFile(wb, `time_report_${format(dateRange.start, 'yyyy-MM-dd')}.xlsx`)
    toast.success('Exported XLSX')
  }

  const handleExportCSV = () => {
    const data = filtered.map(e => ({
      Date: e.date,
      Staff: e.staffName,
      Department: staff.find(s => s.id === e.staffId)?.department || '—',
      Project: e.project,
      Hours: e.hours,
      Status: e.status
    }))
    exportCSV(data, `time_report_${format(dateRange.start, 'yyyy-MM-dd')}.csv`)
  }

  const handleExportPDF = () => {
    const columns = [
      { key: 'date', label: 'Date' },
      { key: 'staff', label: 'Staff' },
      { key: 'project', label: 'Project' },
      { key: 'hours', label: 'Hrs' },
      { key: 'status', label: 'Status' }
    ]
    const rows = filtered.map(e => ({
      date: e.date,
      staff: e.staffName,
      project: e.project,
      hours: e.hours + 'h',
      status: e.status
    }))
    exportPDF(rows, columns, 'Detailed Time Report', `time_report_${format(dateRange.start, 'yyyy-MM-dd')}.pdf`)
  }

  return (
    <div className="flex flex-col gap-4">
      {showImport && <BulkTimeEntryImport onClose={() => setShowImport(false)} />}
      <div className="card flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="font-bold text-1">Detailed Time Entries</h3>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={() => setShowImport(true)}>📥 Bulk Import</button>
            <button className="btn btn-secondary btn-sm" onClick={exportXLSX}>📁 XLSX</button>
            <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>📄 CSV</button>
            <button className="btn btn-secondary btn-sm" onClick={handleExportPDF}>📕 PDF</button>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <input
            className="form-input text-xs flex-1"
            style={{ minWidth: '200px' }}
            placeholder="Search staff or desc..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="form-select text-xs" style={{ minWidth: '150px' }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="form-select text-xs" style={{ minWidth: '150px' }} value={projFilter} onChange={e => setProjFilter(e.target.value)}>
            <option value="">All Projects</option>
            {projectNames.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="form-select text-xs" style={{ minWidth: '150px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="submitted">Submitted</option>
            <option value="rejected">Rejected</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap" style={{ maxHeight: 500 }}>
          <table>
            <thead className="sticky top-0 bg-surface z-10">
              <tr>
                <th>Date</th>
                <th>Staff</th>
                <th>Project</th>
                <th>Category</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap font-mono text-[11px] text-3">{e.date}</td>
                  <td className="font-medium whitespace-nowrap">{e.staffName}</td>
                  <td className="truncate max-w-[120px]" title={e.project}>{e.project}</td>
                  <td className="text-3 text-xs">{e.category}</td>
                  <td className="font-bold">{e.hours}h</td>
                  <td>
                    <span className={`badge badge-${
                      e.status === 'approved' ? 'green' : 
                      e.status === 'rejected' ? 'red' : 
                      ['submitted', 'resubmitted'].includes(e.status) ? 'yellow' : 'gray'
                    }`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="text-3 text-xs italic truncate max-w-[200px]" title={e.description}>{e.description}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-4 italic">No entries match your filters in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-3 text-xs text-4 flex justify-between items-center bg-2">
            <span>Showing {filtered.length} entries</span>
            <span className="font-bold text-accent">Total: {filtered.reduce((s, e) => s + (e.hours || 0), 0).toFixed(1)}h</span>
        </div>
      </div>
    </div>
  )
}
