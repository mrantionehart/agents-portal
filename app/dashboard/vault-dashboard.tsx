'use client'

import {
  Search,
  Bell,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
  Users,
  DollarSign,
  FileText,
  Shield,
  UserPlus,
  Activity,
  Award,
  BookOpen,
  Calendar,
  ChevronRight,
  Phone,
  MapPin,
  ArrowUpRight,
  ArrowDownRight,
  CircleDot,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types & Props
// ---------------------------------------------------------------------------
interface VaultDashboardProps {
  user: any
  role: string
  viewMode: string
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  delta,
  deltaDirection,
  accentBorderLeft,
  warningDot,
}: {
  label: string
  value: string
  delta?: string
  deltaDirection?: 'up' | 'down' | 'neutral'
  accentBorderLeft?: boolean
  warningDot?: boolean
}) {
  return (
    <div
      className={`relative rounded-2xl p-6 ${
        accentBorderLeft ? 'border-l-[3px] border-l-[#B89B5E]' : ''
      }`}
      style={{
        background: '#121214',
        border: accentBorderLeft ? undefined : '1px solid rgba(255,255,255,0.08)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <p
          className="font-medium tracking-[0.08em] uppercase"
          style={{ color: '#8D8D94', fontSize: '11px', fontFamily: 'var(--font-inter)' }}
        >
          {label}
        </p>
        {warningDot && (
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        )}
      </div>
      <p
        className="font-bold"
        style={{ color: '#F8F8F6', fontSize: '32px', lineHeight: '1.1', fontFamily: 'var(--font-inter)' }}
      >
        {value}
      </p>
      {delta && (
        <div className="flex items-center gap-1 mt-2">
          {deltaDirection === 'up' && <ArrowUpRight className="w-3.5 h-3.5" style={{ color: '#A7F3D0' }} />}
          {deltaDirection === 'down' && <ArrowDownRight className="w-3.5 h-3.5" style={{ color: '#F4B4B4' }} />}
          <span
            className="text-xs font-medium"
            style={{
              color:
                deltaDirection === 'up'
                  ? '#A7F3D0'
                  : deltaDirection === 'down'
                  ? '#F4B4B4'
                  : '#B7B7BD',
            }}
          >
            {delta}
          </span>
        </div>
      )}
    </div>
  )
}

type ChipVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

function StatusChip({ label, variant }: { label: string; variant: ChipVariant }) {
  const styles: Record<ChipVariant, { bg: string; text: string; border: string }> = {
    success: {
      bg: 'rgba(16,185,129,0.12)',
      text: '#A7F3D0',
      border: 'rgba(16,185,129,0.28)',
    },
    warning: {
      bg: 'rgba(245,158,11,0.12)',
      text: '#F6D28A',
      border: 'rgba(245,158,11,0.28)',
    },
    danger: {
      bg: 'rgba(239,68,68,0.12)',
      text: '#F4B4B4',
      border: 'rgba(239,68,68,0.28)',
    },
    info: {
      bg: 'rgba(59,130,246,0.12)',
      text: '#BFDBFE',
      border: 'rgba(59,130,246,0.28)',
    },
    neutral: {
      bg: 'rgba(255,255,255,0.06)',
      text: '#B7B7BD',
      border: 'rgba(255,255,255,0.12)',
    },
  }
  const s = styles[variant]
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {label}
    </span>
  )
}

function ActivityItem({
  icon: Icon,
  text,
  time,
}: {
  icon: React.ElementType
  text: string
  time: string
}) {
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      >
        <Icon className="w-4 h-4" style={{ color: '#8D8D94' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: '#F8F8F6', fontFamily: 'var(--font-inter)' }}>
          {text}
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#8D8D94', fontFamily: 'var(--font-inter)' }}>
          {time}
        </p>
      </div>
    </div>
  )
}

function LeaderboardRow({
  rank,
  name,
  revenue,
  deals,
}: {
  rank: number
  name: string
  revenue: string
  deals: number
}) {
  const isGold = rank === 1
  return (
    <div
      className="flex items-center gap-4 py-3 px-1"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{
          background: isGold ? 'rgba(184,155,94,0.18)' : 'rgba(255,255,255,0.06)',
          color: isGold ? '#B89B5E' : '#8D8D94',
          border: isGold ? '1px solid rgba(184,155,94,0.35)' : '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: isGold ? '#F8F8F6' : '#B7B7BD', fontFamily: 'var(--font-inter)' }}
        >
          {name}
        </p>
      </div>
      <span className="text-sm font-semibold" style={{ color: '#F8F8F6', fontFamily: 'var(--font-inter)' }}>
        {revenue}
      </span>
      <span className="text-xs px-2 py-0.5 rounded" style={{ color: '#8D8D94', background: 'rgba(255,255,255,0.04)' }}>
        {deals} deals
      </span>
    </div>
  )
}

function SectionCard({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div
      className="rounded-2xl p-5 h-full flex flex-col"
      style={{ background: '#121214', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4" style={{ color: '#8D8D94' }} />
          <h3
            className="font-semibold text-sm tracking-wide"
            style={{ color: '#F8F8F6', fontFamily: 'var(--font-inter)' }}
          >
            {title}
          </h3>
        </div>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Static demo data
// ---------------------------------------------------------------------------

const pipelineData = [
  { month: 'Nov', value: 128000 },
  { month: 'Dec', value: 156000 },
  { month: 'Jan', value: 142000 },
  { month: 'Feb', value: 189000 },
  { month: 'Mar', value: 201000 },
  { month: 'Apr', value: 214540 },
]

const complianceQueue = [
  { text: 'License renewal - Sarah Chen', detail: 'Due in 5 days', variant: 'warning' as ChipVariant },
  { text: 'File review - 123 Oak St', detail: 'Overdue', variant: 'danger' as ChipVariant },
  { text: 'E&O insurance - Marcus Webb', detail: 'Due in 12 days', variant: 'info' as ChipVariant },
  { text: 'Disclosure packet - 456 Elm Ave', detail: 'Pending review', variant: 'warning' as ChipVariant },
  { text: 'Background check - James Wilson', detail: 'In progress', variant: 'info' as ChipVariant },
]

const recruits = [
  { name: 'Angela Torres', license: 'Salesperson', location: 'Houston, TX', status: 'New Lead' as const },
  { name: 'David Kim', license: 'Broker Associate', location: 'Austin, TX', status: 'Contacted' as const },
  { name: 'Priya Sharma', license: 'Salesperson', location: 'Dallas, TX', status: 'Interview Set' as const },
]

const onboardingStages = [
  { stage: 'Applied', count: 3, color: '#BFDBFE' },
  { stage: 'Screening', count: 2, color: '#F6D28A' },
  { stage: 'Training', count: 4, color: '#B89B5E' },
  { stage: 'Active', count: 1, color: '#A7F3D0' },
]

const activityFeed = [
  { icon: DollarSign, text: 'Sarah Chen closed deal at 123 Main St', time: '2 min ago' },
  { icon: UserPlus, text: 'New recruit application: James Wilson', time: '15 min ago' },
  { icon: FileText, text: 'Marcus Webb uploaded disclosure for 789 Pine Rd', time: '32 min ago' },
  { icon: Award, text: 'Team hit $1M monthly volume milestone', time: '1 hr ago' },
  { icon: BookOpen, text: 'Priya Sharma completed Vol 1 Module 3', time: '2 hr ago' },
  { icon: Shield, text: 'Compliance review completed for Q1 filings', time: '3 hr ago' },
]

const leaderboard = [
  { rank: 1, name: 'Sarah Chen', revenue: '$68,200', deals: 4 },
  { rank: 2, name: 'Marcus Webb', revenue: '$52,400', deals: 3 },
  { rank: 3, name: 'David Park', revenue: '$41,100', deals: 3 },
  { rank: 4, name: 'Lisa Nguyen', revenue: '$33,800', deals: 2 },
  { rank: 5, name: 'Robert Hayes', revenue: '$19,040', deals: 1 },
]

const nonCompliantAgents = [
  { name: 'Jake Morrison', module: 'Module 5 - Ethics' },
  { name: 'Tanya Brooks', module: 'Module 3 - Disclosures' },
  { name: 'Enrique Padilla', module: 'Module 7 - Fair Housing' },
]

const upcomingPayouts = [
  { agent: 'Sarah Chen', amount: '$34,100', date: 'Apr 25' },
  { agent: 'Marcus Webb', amount: '$26,200', date: 'Apr 28' },
  { agent: 'David Park', amount: '$15,900', date: 'Apr 30' },
  { agent: 'Lisa Nguyen', amount: '$10,000', date: 'May 2' },
]

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function VaultDashboard({ user, role, viewMode }: VaultDashboardProps) {
  const maxPipeline = Math.max(...pipelineData.map((d) => d.value))

  const today = new Date()
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const recruitStatusVariant: Record<string, ChipVariant> = {
    'New Lead': 'info',
    Contacted: 'warning',
    'Interview Set': 'success',
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen" style={{ background: '#0A0A0B' }}>
      {/* Sticky Top Bar */}
      <header
        className="sticky top-0 z-40 px-8 py-4 flex items-center justify-between"
        style={{ background: '#121214', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div>
          <h1
            className="text-lg font-bold tracking-tight"
            style={{ color: '#F8F8F6', fontFamily: 'var(--font-inter)' }}
          >
            Command Center
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#8D8D94', fontFamily: 'var(--font-inter)' }}>
            {formattedDate}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            className="w-9 h-9 rounded-xl flex items-center justify-center transition hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <Search className="w-4 h-4" style={{ color: '#8D8D94' }} />
          </button>
          <button
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <Bell className="w-4 h-4" style={{ color: '#8D8D94' }} />
            <span
              className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full text-[10px] font-bold flex items-center justify-center"
              style={{ background: '#B89B5E', color: '#0A0A0B', width: '18px', height: '18px' }}
            >
              3
            </span>
          </button>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
            style={{
              background: 'linear-gradient(135deg, #B89B5E 0%, #9D824B 100%)',
              color: '#0A0A0B',
              fontFamily: 'var(--font-inter)',
            }}
          >
            {(user?.user_metadata?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Scrollable main area */}
      <main className="flex-1 overflow-y-auto px-8 py-8 space-y-6">
        {/* Row 1: Executive KPIs */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Revenue This Month" value="$214,540" delta="+12.3% vs last month" deltaDirection="up" />
          <KpiCard label="Pending Payouts" value="$86,200" accentBorderLeft />
          <KpiCard label="Files Awaiting Review" value="11" warningDot delta="6 urgent" deltaDirection="neutral" />
          <KpiCard label="Active Agents" value="47" delta="+3 this month" deltaDirection="up" />
        </div>

        {/* Row 2: Intelligence Zone */}
        <div className="grid grid-cols-12 gap-4">
          {/* Pipeline Forecast */}
          <div className="col-span-8">
            <SectionCard title="Pipeline Forecast" icon={TrendingUp}>
              <div className="flex items-end gap-3 mt-2" style={{ height: '180px' }}>
                {pipelineData.map((d) => {
                  const pct = (d.value / maxPipeline) * 100
                  return (
                    <div key={d.month} className="flex-1 flex flex-col items-center gap-2">
                      <span
                        className="text-[11px] font-medium"
                        style={{ color: '#B7B7BD', fontFamily: 'var(--font-inter)' }}
                      >
                        ${(d.value / 1000).toFixed(0)}K
                      </span>
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className="w-full rounded-t-lg transition-all"
                          style={{
                            height: `${pct}%`,
                            background: 'linear-gradient(180deg, #B89B5E 0%, #9D824B 100%)',
                            minHeight: '16px',
                          }}
                        />
                      </div>
                      <span
                        className="text-[11px] font-medium"
                        style={{ color: '#8D8D94', fontFamily: 'var(--font-inter)' }}
                      >
                        {d.month}
                      </span>
                    </div>
                  )
                })}
              </div>
            </SectionCard>
          </div>

          {/* Compliance & Risk Queue */}
          <div className="col-span-4">
            <SectionCard title="Compliance & Risk Queue" icon={Shield}>
              <div className="space-y-0">
                {complianceQueue.map((item, i) => (
                  <div
                    key={i}
                    className="py-2.5 flex items-start justify-between gap-2 transition hover:opacity-80 cursor-pointer"
                    style={{ borderBottom: i < complianceQueue.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                  >
                    <div className="min-w-0">
                      <p
                        className="text-sm truncate"
                        style={{ color: '#F8F8F6', fontFamily: 'var(--font-inter)' }}
                      >
                        {item.text}
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: '#8D8D94', fontFamily: 'var(--font-inter)' }}
                      >
                        {item.detail}
                      </p>
                    </div>
                    <StatusChip label={item.variant === 'danger' ? 'Overdue' : item.variant === 'warning' ? 'Warning' : 'Pending'} variant={item.variant} />
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>

        {/* Row 3: Recruiting / Onboarding / Activity */}
        <div className="grid grid-cols-3 gap-4">
          {/* Recruiting Intelligence */}
          <SectionCard title="Recruiting Intelligence" icon={UserPlus}>
            <div className="space-y-3">
              {recruits.map((r) => (
                <div
                  key={r.name}
                  className="rounded-xl p-3.5"
                  style={{ background: '#17171A', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p
                        className="text-sm font-semibold"
                        style={{ color: '#F8F8F6', fontFamily: 'var(--font-inter)' }}
                      >
                        {r.name}
                      </p>
                      <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#8D8D94' }}>
                        <MapPin className="w-3 h-3" /> {r.location}
                      </p>
                    </div>
                    <StatusChip label={r.status} variant={recruitStatusVariant[r.status]} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs" style={{ color: '#B7B7BD', fontFamily: 'var(--font-inter)' }}>
                      {r.license}
                    </span>
                    <button
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition hover:opacity-90"
                      style={{ background: '#B89B5E', color: '#0A0A0B' }}
                    >
                      <Phone className="w-3 h-3" />
                      Contact
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Onboarding Pipeline */}
          <SectionCard title="Onboarding Pipeline" icon={Users}>
            <div className="flex flex-col items-center justify-center h-full gap-4 py-2">
              {onboardingStages.map((s, i) => {
                const widthPct = 100 - i * 18
                return (
                  <div key={s.stage} className="w-full flex flex-col items-center">
                    <div
                      className="rounded-xl py-3 px-4 flex items-center justify-between transition"
                      style={{
                        width: `${widthPct}%`,
                        background: `${s.color}12`,
                        border: `1px solid ${s.color}40`,
                      }}
                    >
                      <span
                        className="text-sm font-medium"
                        style={{ color: s.color, fontFamily: 'var(--font-inter)' }}
                      >
                        {s.stage}
                      </span>
                      <span
                        className="text-lg font-bold"
                        style={{ color: s.color, fontFamily: 'var(--font-inter)' }}
                      >
                        {s.count}
                      </span>
                    </div>
                    {i < onboardingStages.length - 1 && (
                      <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.12)' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </SectionCard>

          {/* Live Activity Feed */}
          <SectionCard title="Live Activity Feed" icon={Activity}>
            <div>
              {activityFeed.map((item, i) => (
                <ActivityItem key={i} icon={item.icon} text={item.text} time={item.time} />
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Row 4: Leaderboard / Training / Payouts */}
        <div className="grid grid-cols-3 gap-4">
          {/* Team Leaderboard */}
          <SectionCard title="Team Leaderboard" icon={Award}>
            <div>
              {leaderboard.map((l) => (
                <LeaderboardRow key={l.rank} rank={l.rank} name={l.name} revenue={l.revenue} deals={l.deals} />
              ))}
            </div>
          </SectionCard>

          {/* Training Compliance */}
          <SectionCard
            title="Training Compliance"
            icon={BookOpen}
            action={
              <button
                className="text-xs font-medium transition hover:opacity-80"
                style={{ color: '#B89B5E', fontFamily: 'var(--font-inter)' }}
              >
                View All
              </button>
            }
          >
            <div>
              {/* Progress indicator */}
              <div className="flex items-center gap-4 mb-5">
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      fill="none"
                      stroke="#B89B5E"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${(38 / 47) * 213.6} 213.6`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                      className="text-lg font-bold"
                      style={{ color: '#F8F8F6', fontFamily: 'var(--font-inter)' }}
                    >
                      38
                    </span>
                    <span className="text-[10px]" style={{ color: '#8D8D94' }}>
                      /47
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#F8F8F6', fontFamily: 'var(--font-inter)' }}>
                    Vol 1 Complete
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#8D8D94', fontFamily: 'var(--font-inter)' }}>
                    81% of agents certified
                  </p>
                </div>
              </div>

              {/* Non-compliant list */}
              <p
                className="text-[11px] uppercase tracking-[0.08em] font-medium mb-2"
                style={{ color: '#8D8D94', fontFamily: 'var(--font-inter)' }}
              >
                Needs attention
              </p>
              <div className="space-y-0">
                {nonCompliantAgents.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2"
                    style={{
                      borderBottom:
                        i < nonCompliantAgents.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    }}
                  >
                    <div>
                      <p className="text-sm" style={{ color: '#F8F8F6', fontFamily: 'var(--font-inter)' }}>
                        {a.name}
                      </p>
                      <p className="text-xs" style={{ color: '#8D8D94', fontFamily: 'var(--font-inter)' }}>
                        {a.module}
                      </p>
                    </div>
                    <StatusChip label="Incomplete" variant="warning" />
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Upcoming Payouts */}
          <SectionCard title="Upcoming Payouts" icon={DollarSign}>
            <div>
              {upcomingPayouts.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-3"
                  style={{
                    borderBottom:
                      i < upcomingPayouts.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#F8F8F6', fontFamily: 'var(--font-inter)' }}>
                      {p.agent}
                    </p>
                    <p className="text-xs flex items-center gap-1" style={{ color: '#8D8D94', fontFamily: 'var(--font-inter)' }}>
                      <Calendar className="w-3 h-3" />
                      {p.date}
                    </p>
                  </div>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: '#F8F8F6', fontFamily: 'var(--font-inter)' }}
                  >
                    {p.amount}
                  </span>
                </div>
              ))}

              {/* Total */}
              <div
                className="flex items-center justify-between pt-4 mt-2"
                style={{ borderTop: '1px solid rgba(255,255,255,0.14)' }}
              >
                <span
                  className="text-xs uppercase tracking-[0.08em] font-medium"
                  style={{ color: '#8D8D94', fontFamily: 'var(--font-inter)' }}
                >
                  Total Pending
                </span>
                <span
                  className="text-base font-bold"
                  style={{ color: '#B89B5E', fontFamily: 'var(--font-inter)' }}
                >
                  $86,200
                </span>
              </div>
            </div>
          </SectionCard>
        </div>
      </main>
    </div>
  )
}
