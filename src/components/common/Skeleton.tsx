'use client'
import React from 'react'

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export default function Skeleton({ width = '100%', height = 20, borderRadius = 8, className = '', style = {} }: SkeletonProps) {
  return (
    <div 
      className={`skeleton ${className}`}
      style={{ 
        width, 
        height, 
        borderRadius, 
        ...style 
      }} 
    />
  )
}
