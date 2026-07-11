import type { SchoolHours, SleepWindow } from '../types'

export const DEFAULT_SCHOOL_HOURS: SchoolHours = {
  0: { enabled: false, start: '08:00', end: '15:00' },
  1: { enabled: true, start: '08:00', end: '15:00' },
  2: { enabled: true, start: '08:00', end: '15:00' },
  3: { enabled: true, start: '08:00', end: '15:00' },
  4: { enabled: true, start: '08:00', end: '15:00' },
  5: { enabled: true, start: '08:00', end: '14:15' },
  6: { enabled: false, start: '08:00', end: '15:00' },
}

export const DEFAULT_SLEEP_WINDOW: SleepWindow = { start: '23:00', end: '07:00' }
