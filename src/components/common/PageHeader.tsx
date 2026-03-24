'use client'
import React, { ReactNode } from 'react'

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
  actions?: ReactNode;
}

export default function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
  return (
    <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {icon && (
          <div style={{ 
            width: 48, 
            height: 48, 
            borderRadius: 12, 
            background: 'var(--accent-subtle)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: 24,
            border: '1px solid var(--accent-glow)'
          }}>
            {icon}
          </div>
        )}
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{title}</h1>
          {subtitle && <p className="page-subtitle" style={{ margin: '4px 0 0', opacity: 0.8 }}>{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 10 }}>
          {actions}
        </div>
      )}
    </div>
  )
}
