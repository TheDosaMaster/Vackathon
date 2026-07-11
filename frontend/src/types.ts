export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday

export interface DayHours {
  enabled: boolean
  start: string // "HH:mm"
  end: string // "HH:mm"
}

export type SchoolHours = Record<Weekday, DayHours>

export interface SleepWindow {
  start: string // bedtime, "HH:mm"
  end: string // wake time, "HH:mm"
}

export interface ClassInfo {
  id: string
  name: string
  teacher: string
  period: string
}

export type AssignmentStatus = 'not-started' | 'in-progress' | 'done'

export interface Assignment {
  id: string
  classId: string
  title: string
  description: string
  dueAt: string // ISO
  estimatedMinutes: number
  status: AssignmentStatus
}

export type EventKind = 'personal' | 'work-session' | 'school' | 'sleep'

export interface CalendarEvent {
  id: string
  title: string
  start: string // ISO
  end: string // ISO
  kind: EventKind
  assignmentId?: string
  editable: boolean
}

export interface ScheduleWarning {
  assignmentId: string
  minutesShort: number
}

export interface ScheduleResult {
  workSessions: CalendarEvent[]
  atRisk: Set<string>
  warnings: ScheduleWarning[]
}
