import type { Assignment, CalendarEvent, ClassInfo, ScheduleWarning, SchoolHours, SleepWindow } from '../types'

export type BackendStatus = 'checking' | 'online' | 'offline'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:5001'
const API_ORIGIN = new URL(API_URL, window.location.origin).origin

interface ClassroomCourse {
  id: string
  name?: string
  section?: string
}

interface ClassroomAssignment {
  id?: string
  courseId?: string
  courseName?: string
  title?: string
  description?: string
  dueDate?: {
    year?: number
    month?: number
    day?: number
  }
  dueTime?: {
    hours?: number
    minutes?: number
  }
}

interface CoursesResponse {
  courses?: ClassroomCourse[]
}

interface AssignmentsResponse {
  assignments?: ClassroomAssignment[]
}

interface PriorityItem {
  id?: string
  priorityScore?: number
  priorityReason?: string
  recommendedMinutes?: number
}

interface PrioritizeResponse {
  provider: 'gemini' | 'fallback' | 'none'
  model?: string
  summary?: string
  priorities?: PriorityItem[]
}

export interface ChatMessagePayload {
  role: 'bot' | 'user'
  text: string
}

export interface CalendarActionResult {
  type: 'create' | 'update' | 'delete'
  success: boolean
  eventId?: string
  title?: string
  error?: string
}

interface ChatResponse {
  provider: 'gemini' | 'fallback'
  model?: string
  text: string
  actions?: CalendarActionResult[]
  calendarChanged?: boolean
}

export async function checkBackend(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/`, { signal })
    if (!response.ok) return false
    const data = (await response.json()) as { status?: string }
    return data.status === 'online'
  } catch {
    return false
  }
}

export function googleAuthUrl(): string {
  return `${API_URL}/auth/google`
}

export function openGoogleAuthPopup(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const width = 500
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const popup = window.open(
      googleAuthUrl(),
      'google-auth',
      `width=${width},height=${height},left=${left},top=${top}`,
    )
    if (!popup) {
      resolve({ success: false, error: 'The Google sign-in popup was blocked. Allow popups and try again.' })
      return
    }

    function onMessage(event: MessageEvent) {
      const source = new URL(event.origin)
      const expected = new URL(API_ORIGIN)
      const localAlias = ['localhost', '127.0.0.1'].includes(source.hostname)
        && ['localhost', '127.0.0.1'].includes(expected.hostname)
        && source.port === expected.port
      if (event.origin !== API_ORIGIN && !localAlias) return
      if (event.data && typeof event.data.success === 'boolean') {
        cleanup()
        resolve(event.data)
      }
    }

    function cleanup() {
      window.removeEventListener('message', onMessage)
      if (pollTimer) clearInterval(pollTimer)
    }

    window.addEventListener('message', onMessage)

    // Fallback: detect popup close via polling (some browsers block postMessage)
    const pollTimer = window.setInterval(() => {
      if (popup.closed) {
        cleanup()
        resolve({ success: false, error: 'Popup was closed before authentication completed.' })
      }
    }, 500)
  })
}

export async function fetchClassroomData(signal?: AbortSignal): Promise<{
  classes: ClassInfo[]
  assignments: Assignment[]
}> {
  const [coursesResponse, assignmentsResponse] = await Promise.all([
    fetchJson<CoursesResponse>('/classroom/courses', signal),
    fetchJson<AssignmentsResponse>('/classroom/assignments', signal),
  ])

  const classes = (coursesResponse.courses ?? []).map((course) => ({
    id: course.id,
    name: course.name ?? 'Untitled course',
    teacher: 'Google Classroom',
    period: course.section || 'Classroom',
  }))

  const assignments = (assignmentsResponse.assignments ?? [])
    .filter((assignment) => assignment.id && assignment.courseId && assignment.dueDate && !('error' in assignment))
    .map(mapAssignment)

  return { classes, assignments }
}

interface GoogleCalendarEvent {
  id?: string
  summary?: string
  description?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

interface CalendarEventsResponse {
  events?: GoogleCalendarEvent[]
}

export async function fetchCalendarEvents(
  timeMin?: string,
  timeMax?: string,
  signal?: AbortSignal,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams()
  if (timeMin) params.set('timeMin', timeMin)
  if (timeMax) params.set('timeMax', timeMax)
  const query = params.toString() ? `?${params}` : ''

  const response = await fetchJson<CalendarEventsResponse>(`/calendar/events${query}`, signal)

  return (response.events ?? []).map((event) => ({
    id: event.id ?? `gcal-${Math.random().toString(36).slice(2)}`,
    title: event.summary ?? 'Untitled event',
    start: event.start?.dateTime ?? event.start?.date ?? new Date().toISOString(),
    end: event.end?.dateTime ?? event.end?.date ?? new Date().toISOString(),
    kind: 'personal' as const,
    editable: true,
  }))
}

export async function createCalendarEvent(
  event: Pick<CalendarEvent, 'title' | 'start' | 'end'> & { description?: string },
): Promise<CalendarEvent> {
  const response = await fetchJson<{ event: GoogleCalendarEvent }>('/calendar/events', undefined, event)
  return mapCalendarEvent(response.event)
}

export async function updateCalendarEvent(
  id: string,
  patch: Partial<Pick<CalendarEvent, 'title' | 'start' | 'end'>>,
): Promise<CalendarEvent> {
  const response = await fetchJson<{ event: GoogleCalendarEvent }>(
    `/calendar/events/${encodeURIComponent(id)}`,
    undefined,
    patch,
    'PATCH',
  )
  return mapCalendarEvent(response.event)
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await fetchJson(`/calendar/events/${encodeURIComponent(id)}`, undefined, undefined, 'DELETE')
}

export async function prioritizeAssignments(
  input: {
    assignments: Assignment[]
    personalEvents: CalendarEvent[]
    schoolHours: SchoolHours
    sleepWindow: SleepWindow
    warnings?: ScheduleWarning[]
    now: Date
  },
  signal?: AbortSignal,
): Promise<{
  assignments: Assignment[]
  summary: string
  provider: PrioritizeResponse['provider']
}> {
  const response = await fetchJson<PrioritizeResponse>('/ai/prioritize-schedule', signal, {
    assignments: input.assignments,
    personalEvents: input.personalEvents,
    schoolHours: input.schoolHours,
    sleepWindow: input.sleepWindow,
    warnings: input.warnings ?? [],
    now: input.now.toISOString(),
  })

  const priorities = new Map((response.priorities ?? []).filter((p) => p.id).map((p) => [p.id, p]))
  const assignments = input.assignments.map((assignment) => {
    const priority = priorities.get(assignment.id)
    if (!priority) return assignment
    return {
      ...assignment,
      estimatedMinutes: validMinutes(priority.recommendedMinutes, assignment.estimatedMinutes),
      priorityScore: validScore(priority.priorityScore),
      priorityReason: priority.priorityReason || assignment.priorityReason,
    }
  })

  return {
    assignments,
    summary: response.summary ?? 'Assignments prioritized.',
    provider: response.provider,
  }
}

export async function sendChatMessage(
  message: string,
  context: unknown,
  history: ChatMessagePayload[],
  signal?: AbortSignal,
): Promise<ChatResponse> {
  return fetchJson<ChatResponse>('/ai/chat', signal, {
    message,
    context,
    history,
  })
}

async function fetchJson<T>(path: string, signal?: AbortSignal, body?: unknown, method?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    signal,
    method: method ?? (body ? 'POST' : 'GET'),
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(errorBody?.error || `Backend request failed: ${response.status}`)
  }
  return (await response.json()) as T
}

function mapCalendarEvent(event: GoogleCalendarEvent): CalendarEvent {
  return {
    id: event.id ?? '',
    title: event.summary ?? 'Untitled event',
    start: event.start?.dateTime ?? event.start?.date ?? new Date().toISOString(),
    end: event.end?.dateTime ?? event.end?.date ?? new Date().toISOString(),
    kind: 'personal',
    editable: true,
  }
}

function mapAssignment(assignment: ClassroomAssignment): Assignment {
  const courseId = assignment.courseId ?? 'classroom'
  const title = assignment.title ?? 'Untitled assignment'
  return {
    id: assignment.id ?? `${courseId}-${title}`,
    classId: courseId,
    title,
    description: assignment.description ?? '',
    dueAt: classroomDueToIso(assignment.dueDate, assignment.dueTime),
    estimatedMinutes: estimateMinutes(title, assignment.description),
    status: 'not-started',
  }
}

function classroomDueToIso(
  dueDate?: ClassroomAssignment['dueDate'],
  dueTime?: ClassroomAssignment['dueTime'],
): string {
  if (!dueDate?.year || !dueDate.month || !dueDate.day) {
    throw new Error('Google Classroom assignment has no due date.')
  }

  const due = new Date(
    dueDate.year,
    dueDate.month - 1,
    dueDate.day,
    dueTime?.hours ?? 23,
    dueTime?.minutes ?? 59,
    0,
    0,
  )
  return due.toISOString()
}

function estimateMinutes(title: string, description = ''): number {
  const text = `${title} ${description}`.toLowerCase()
  if (text.includes('project') || text.includes('essay') || text.includes('presentation')) return 180
  if (text.includes('lab') || text.includes('report')) return 120
  if (text.includes('quiz') || text.includes('review')) return 45
  return 75
}

function validScore(score: number | undefined): number | undefined {
  if (typeof score !== 'number' || Number.isNaN(score)) return undefined
  return Math.min(100, Math.max(0, Math.round(score)))
}

function validMinutes(minutes: number | undefined, fallback: number): number {
  if (typeof minutes !== 'number' || Number.isNaN(minutes)) return fallback
  return Math.min(600, Math.max(15, Math.round(minutes)))
}
