import type { Assignment, CalendarEvent, ScheduleResult, SchoolHours, SleepWindow } from '../types'
import { addDays, addMinutes, dateAtMinutes, startOfDay, toMinutes, weekdayOf, MINUTES_PER_DAY } from './date'

/** A blocked or free stretch of a single day, in minutes-from-midnight. */
interface Interval {
  start: number
  end: number
}

const SESSION_MAX_MINUTES = 90
const SESSION_MIN_MINUTES = 30
const DAILY_CAP_PER_ASSIGNMENT_MINUTES = 120
const HORIZON_DAYS = 14

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const merged: Interval[] = [sorted[0]]
  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1]
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end)
    } else {
      merged.push({ ...current })
    }
  }
  return merged
}

function invert(intervals: Interval[], dayStart = 0, dayEnd = MINUTES_PER_DAY): Interval[] {
  const merged = mergeIntervals(intervals)
  const free: Interval[] = []
  let cursor = dayStart
  for (const block of merged) {
    if (block.start > cursor) free.push({ start: cursor, end: Math.min(block.start, dayEnd) })
    cursor = Math.max(cursor, block.end)
  }
  if (cursor < dayEnd) free.push({ start: cursor, end: dayEnd })
  return free.filter((f) => f.end - f.start >= SESSION_MIN_MINUTES)
}

/** Blocked intervals for a single calendar day: sleep, school, and any personal/work-session events landing on that day. */
function blockedIntervalsForDay(
  day: Date,
  schoolHours: SchoolHours,
  sleepWindow: SleepWindow,
  existingEvents: CalendarEvent[],
): Interval[] {
  const blocked: Interval[] = []

  const wake = toMinutes(sleepWindow.end)
  const bedtime = toMinutes(sleepWindow.start)
  blocked.push({ start: 0, end: wake })
  blocked.push({ start: bedtime, end: MINUTES_PER_DAY })

  const hours = schoolHours[weekdayOf(day)]
  if (hours.enabled) {
    blocked.push({ start: toMinutes(hours.start), end: toMinutes(hours.end) })
  }

  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)
  for (const event of existingEvents) {
    const start = new Date(event.start)
    const end = new Date(event.end)
    if (end <= dayStart || start >= dayEnd) continue
    const clippedStart = Math.max(0, Math.round((start.getTime() - dayStart.getTime()) / 60_000))
    const clippedEnd = Math.min(
      MINUTES_PER_DAY,
      Math.round((end.getTime() - dayStart.getTime()) / 60_000),
    )
    blocked.push({ start: clippedStart, end: clippedEnd })
  }

  return blocked
}

interface SchedulerInput {
  assignments: Assignment[]
  personalEvents: CalendarEvent[]
  schoolHours: SchoolHours
  sleepWindow: SleepWindow
  now: Date
}

/**
 * Greedy earliest-deadline-first scheduler: fills real free time (whatever's left after
 * sleep, school, and existing calendar events) with work sessions, always targeting at
 * least one day of buffer before each due date. Assignments that can't fit before their
 * buffer deadline are flagged at-risk and scheduled as close to on-time as the calendar allows.
 */
export function generateSchedule({
  assignments,
  personalEvents,
  schoolHours,
  sleepWindow,
  now,
}: SchedulerInput): ScheduleResult {
  const pending = assignments.filter((a) => a.status !== 'done')
  const horizonEnd = addDays(startOfDay(now), HORIZON_DAYS)

  // Per-day mutable "already spoken for" ledger, seeded with existing events; work
  // sessions we schedule get pushed in as we go so assignments never overlap each other.
  const dayLedger = new Map<string, CalendarEvent[]>()
  const dayKey = (d: Date) => startOfDay(d).toISOString()

  const freeIntervalsForDay = (day: Date): Interval[] => {
    const key = dayKey(day)
    const scheduledSoFar = dayLedger.get(key) ?? []
    const blocked = blockedIntervalsForDay(day, schoolHours, sleepWindow, [
      ...personalEvents,
      ...scheduledSoFar,
    ])
    return invert(blocked)
  }

  const sorted = [...pending].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  )

  const workSessions: CalendarEvent[] = []
  const atRisk = new Set<string>()
  const warnings: ScheduleResult['warnings'] = []

  for (const assignment of sorted) {
    const dueDate = new Date(assignment.dueAt)
    const bufferDeadline = addDays(dueDate, -1)
    let remaining = assignment.estimatedMinutes
    let cursorDay = startOfDay(now)
    const hardEnd = dueDate < horizonEnd ? dueDate : horizonEnd

    // Pass 1: fill only up to the buffer deadline (the honest, on-target attempt).
    while (remaining > 0 && cursorDay < bufferDeadline && cursorDay < horizonEnd) {
      remaining = placeSessionsOnDay({
        day: cursorDay,
        assignment,
        remaining,
        now,
        freeIntervalsForDay,
        dayLedger,
        dayKey,
        workSessions,
        capUntil: bufferDeadline,
      })
      cursorDay = addDays(cursorDay, 1)
    }

    // Pass 2: if buffer time ran out, keep going right up to the actual due date so the
    // assignment still finishes on time even though the day-early promise is broken —
    // and mark it at-risk so the student can see exactly what happened.
    if (remaining > 0) {
      atRisk.add(assignment.id)
      warnings.push({ assignmentId: assignment.id, minutesShort: remaining })
      while (remaining > 0 && cursorDay <= hardEnd) {
        remaining = placeSessionsOnDay({
          day: cursorDay,
          assignment,
          remaining,
          now,
          freeIntervalsForDay,
          dayLedger,
          dayKey,
          workSessions,
          capUntil: hardEnd,
        })
        cursorDay = addDays(cursorDay, 1)
      }
    }
  }

  return { workSessions, atRisk, warnings }
}

interface PlaceSessionsArgs {
  day: Date
  assignment: Assignment
  remaining: number
  now: Date
  freeIntervalsForDay: (day: Date) => Interval[]
  dayLedger: Map<string, CalendarEvent[]>
  dayKey: (d: Date) => string
  workSessions: CalendarEvent[]
  capUntil: Date
}

function placeSessionsOnDay({
  day,
  assignment,
  remaining,
  now,
  freeIntervalsForDay,
  dayLedger,
  dayKey,
  workSessions,
}: PlaceSessionsArgs): number {
  let free = freeIntervalsForDay(day)
  let usedToday = 0
  const isToday = startOfDay(day).getTime() === startOfDay(now).getTime()
  const nowMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : 0

  for (const slot of free) {
    if (remaining <= 0 || usedToday >= DAILY_CAP_PER_ASSIGNMENT_MINUTES) break
    const slotStart = Math.max(slot.start, isToday ? nowMinutes : 0)
    const slotLength = slot.end - slotStart
    if (slotLength < SESSION_MIN_MINUTES) continue

    const sessionLength = Math.min(
      SESSION_MAX_MINUTES,
      slotLength,
      remaining,
      DAILY_CAP_PER_ASSIGNMENT_MINUTES - usedToday,
    )
    if (sessionLength < SESSION_MIN_MINUTES) continue

    const start = dateAtMinutes(day, slotStart)
    const end = addMinutes(start, sessionLength)
    const session: CalendarEvent = {
      id: `session-${assignment.id}-${start.toISOString()}`,
      title: assignment.title,
      start: start.toISOString(),
      end: end.toISOString(),
      kind: 'work-session',
      assignmentId: assignment.id,
      editable: false,
    }
    workSessions.push(session)

    const key = dayKey(day)
    dayLedger.set(key, [...(dayLedger.get(key) ?? []), session])

    remaining -= sessionLength
    usedToday += sessionLength
    // Recompute free time for this day so the next slot search sees this session as busy.
    free = freeIntervalsForDay(day)
  }

  return remaining
}
