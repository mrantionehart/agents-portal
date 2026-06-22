'use client'

import React from 'react'

interface SectionProps {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  id?: string
}

export default function Section({ title, subtitle, actions, children, id }: SectionProps) {
  return (
    <section
      id={id}
      className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-5 mb-4 scroll-mt-20"
    >
      <header className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-zinc-100 text-lg font-semibold">{title}</h2>
          {subtitle && <div className="text-zinc-400 text-sm mt-0.5">{subtitle}</div>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <div className="text-zinc-200">{children}</div>
    </section>
  )
}
