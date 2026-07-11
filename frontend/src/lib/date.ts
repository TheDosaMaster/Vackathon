import type { Weekday } from '../types'

export const MINUTES_PER_DAY = 1440

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function fromMinutes(totalMinutes: number): string {
  const m = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function dateAtMinutes(day: Date, minutes: number): Date {
  return addMinutes(startOfDay(day), minutes)
}

export function weekdayOf(date: Date): Weekday {
  return date.getDay() as Weekday
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso))
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)}–${formatTime(endIso)}`
}

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

export function formatDayLong(date: Date): string {
  return dayFormatter.format(date)
}

const shortDayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

export function formatDayShort(date: Date): string {
  return shortDayFormatter.format(date)
}

export function formatDueCountdown(dueAt: string, now: Date): string {
  const diffMs = new Date(dueAt).getTime() - now.getTime()
  if (diffMs <= 0) return 'Past due'
  const totalMinutes = Math.round(diffMs / 60_000)
  const days = Math.floor(totalMinutes / MINUTES_PER_DAY)
  const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `Due in ${days}d ${hours}h`
  if (hours > 0) return `Due in ${hours}h ${minutes}m`
  return `Due in ${minutes}m`
}

export function weekdayLabel(day: Weekday, short = false): string {
  const labels = short
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return labels[day]
}
