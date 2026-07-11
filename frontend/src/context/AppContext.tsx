import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Assignment, AssignmentStatus, CalendarEvent, SchoolHours, SleepWindow } from '../types'
import {
  CLASSES,
  DEFAULT_SCHOOL_HOURS,
  DEFAULT_SLEEP_WINDOW,
  createMockAssignments,
  createMockPersonalEvents,
} from '../data/mockData'
import { generateSchedule } from '../lib/scheduler'

export type OnboardingStep = 'connect' | 'school-hours' | 'done'

interface ConnectedAccounts {
  calendar: boolean
  classroom: boolean
}

interface PersistedState {
  isSignedIn: boolean
  onboardingStep: OnboardingStep
  connectedAccounts: ConnectedAccounts
  schoolHours: SchoolHours
  sleepWindow: SleepWindow
  personalEvents: CalendarEvent[]
  assignments: Assignment[]
  studentName: string
}

const STORAGE_KEY = 'priority-one-state-v1'

function loadInitialState(): PersistedState {
  const now = new Date()
  const fallback: PersistedState = {
    isSignedIn: false,
    onboardingStep: 'connect',
    connectedAccounts: { calendar: false, classroom: false },
    schoolHours: DEFAULT_SCHOOL_HOURS,
    sleepWindow: DEFAULT_SLEEP_WINDOW,
    personalEvents: createMockPersonalEvents(now),
    assignments: createMockAssignments(now),
    studentName: 'Jordan',
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return { ...fallback, ...parsed }
  } catch {
    return fallback
  }
}

interface AppContextValue {
  isSignedIn: boolean
  studentName: string
  onboardingStep: OnboardingStep
  connectedAccounts: ConnectedAccounts
  schoolHours: SchoolHours
  sleepWindow: SleepWindow
  personalEvents: CalendarEvent[]
  assignments: Assignment[]
  classes: typeof CLASSES
  now: Date
  schedule: ReturnType<typeof generateSchedule>

  signIn: (name: string) => void
  signOut: () => void
  connectAccounts: () => void
  saveSchoolHours: (hours: SchoolHours, sleep: SleepWindow) => void
  updateSchoolHours: (hours: SchoolHours) => void
  updateSleepWindow: (sleep: SleepWindow) => void
  addPersonalEvent: (event: Omit<CalendarEvent, 'id' | 'kind' | 'editable'>) => void
  updatePersonalEvent: (id: string, patch: Partial<Pick<CalendarEvent, 'title' | 'start' | 'end'>>) => void
  deletePersonalEvent: (id: string) => void
  setAssignmentStatus: (id: string, status: AssignmentStatus) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadInitialState)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const signIn = useCallback((name: string) => {
    setState((s) => ({ ...s, isSignedIn: true, studentName: name || s.studentName }))
  }, [])

  const signOut = useCallback(() => {
    setState((s) => ({ ...s, isSignedIn: false, onboardingStep: 'connect', connectedAccounts: { calendar: false, classroom: false } }))
  }, [])

  const connectAccounts = useCallback(() => {
    setState((s) => ({
      ...s,
      connectedAccounts: { calendar: true, classroom: true },
      onboardingStep: 'school-hours',
    }))
  }, [])

  const saveSchoolHours = useCallback((hours: SchoolHours, sleep: SleepWindow) => {
    setState((s) => ({ ...s, schoolHours: hours, sleepWindow: sleep, onboardingStep: 'done' }))
  }, [])

  const updateSchoolHours = useCallback((hours: SchoolHours) => {
    setState((s) => ({ ...s, schoolHours: hours }))
  }, [])

  const updateSleepWindow = useCallback((sleep: SleepWindow) => {
    setState((s) => ({ ...s, sleepWindow: sleep }))
  }, [])

  const addPersonalEvent = useCallback((event: Omit<CalendarEvent, 'id' | 'kind' | 'editable'>) => {
    setState((s) => ({
      ...s,
      personalEvents: [
        ...s.personalEvents,
        { ...event, id: `e-${Date.now()}-${Math.round(Math.random() * 1e6)}`, kind: 'personal', editable: true },
      ],
    }))
  }, [])

  const updatePersonalEvent = useCallback(
    (id: string, patch: Partial<Pick<CalendarEvent, 'title' | 'start' | 'end'>>) => {
      setState((s) => ({
        ...s,
        personalEvents: s.personalEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }))
    },
    [],
  )

  const deletePersonalEvent = useCallback((id: string) => {
    setState((s) => ({ ...s, personalEvents: s.personalEvents.filter((e) => e.id !== id) }))
  }, [])

  const setAssignmentStatus = useCallback((id: string, status: AssignmentStatus) => {
    setState((s) => ({
      ...s,
      assignments: s.assignments.map((a) => (a.id === id ? { ...a, status } : a)),
    }))
  }, [])

  const schedule = useMemo(
    () =>
      generateSchedule({
        assignments: state.assignments,
        personalEvents: state.personalEvents,
        schoolHours: state.schoolHours,
        sleepWindow: state.sleepWindow,
        now,
      }),
    [state.assignments, state.personalEvents, state.schoolHours, state.sleepWindow, now],
  )

  const value: AppContextValue = {
    isSignedIn: state.isSignedIn,
    studentName: state.studentName,
    onboardingStep: state.onboardingStep,
    connectedAccounts: state.connectedAccounts,
    schoolHours: state.schoolHours,
    sleepWindow: state.sleepWindow,
    personalEvents: state.personalEvents,
    assignments: state.assignments,
    classes: CLASSES,
    now,
    schedule,
    signIn,
    signOut,
    connectAccounts,
    saveSchoolHours,
    updateSchoolHours,
    updateSleepWindow,
    addPersonalEvent,
    updatePersonalEvent,
    deletePersonalEvent,
    setAssignmentStatus,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
