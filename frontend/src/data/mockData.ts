import type { Assignment, CalendarEvent, ClassInfo, SchoolHours, SleepWindow, Weekday } from '../types'
import { addDays, addMinutes, dateAtMinutes, startOfDay, toMinutes } from '../lib/date'

export const DEFAULT_SCHOOL_HOURS: SchoolHours = {
  0: { enabled: false, start: '08:00', end: '15:00' },
  1: { enabled: true, start: '08:00', end: '15:00' },
  2: { enabled: true, start: '08:00', end: '15:00' },
  3: { enabled: true, start: '08:00', end: '15:00' },
  4: { enabled: true, start: '08:00', end: '15:00' },
  5: { enabled: true, start: '08:00', end: '14:15' },
  6: { enabled: false, start: '08:00', end: '15:00' },
}

export const DEFAULT_SLEEP_WINDOW: SleepWindow = {
  start: '23:00',
  end: '07:00',
}

export const CLASSES: ClassInfo[] = [
  { id: 'chem', name: 'AP Chemistry', teacher: 'Dr. Alvarez', period: 'Period 2' },
  { id: 'calc', name: 'Calculus BC', teacher: 'Mr. Okafor', period: 'Period 3' },
  { id: 'ushist', name: 'U.S. History', teacher: 'Ms. Reyes', period: 'Period 4' },
  { id: 'english', name: 'English Literature', teacher: 'Mr. Donnelly', period: 'Period 5' },
  { id: 'spanish', name: 'Spanish III', teacher: 'Sra. Marquez', period: 'Period 6' },
  { id: 'cs', name: 'Computer Science', teacher: 'Ms. Park', period: 'Period 7' },
]

function daysFromNow(now: Date, days: number, hhmm: string): string {
  return dateAtMinutes(addDays(startOfDay(now), days), toMinutes(hhmm)).toISOString()
}

export function createMockAssignments(now: Date): Assignment[] {
  return [
    {
      id: 'a-cold-war-slides',
      classId: 'ushist',
      title: 'Group Presentation Slides: The Cold War',
      description: 'Finish your third of the slide deck and send to the group for review.',
      dueAt: daysFromNow(now, 1, '15:00'),
      estimatedMinutes: 120,
      status: 'not-started',
    },
    {
      id: 'a-titration-lab',
      classId: 'chem',
      title: 'Titration Lab Report',
      description: 'Full write-up: hypothesis, procedure, data tables, error analysis.',
      dueAt: daysFromNow(now, 2, '09:00'),
      estimatedMinutes: 150,
      status: 'not-started',
    },
    {
      id: 'a-vocab-quiz',
      classId: 'spanish',
      title: 'Vocab Quiz Prep: Unidad 5',
      description: 'Review flashcards for the unit 5 vocabulary quiz.',
      dueAt: daysFromNow(now, 1, '08:00'),
      estimatedMinutes: 30,
      status: 'not-started',
    },
    {
      id: 'a-reading-response',
      classId: 'ushist',
      title: 'Reading Response: Ch. 12–14',
      description: 'One-page response on the causes of the Cold War.',
      dueAt: daysFromNow(now, 3, '15:00'),
      estimatedMinutes: 45,
      status: 'not-started',
    },
    {
      id: 'a-related-rates',
      classId: 'calc',
      title: 'Problem Set 7: Related Rates',
      description: 'Problems 1–14, show full work for optimization problems.',
      dueAt: daysFromNow(now, 4, '08:00'),
      estimatedMinutes: 90,
      status: 'not-started',
    },
    {
      id: 'a-gatsby-essay',
      classId: 'english',
      title: 'Essay: Symbolism in The Great Gatsby',
      description: '1200-word essay, MLA format, due with a peer-reviewed draft.',
      dueAt: daysFromNow(now, 6, '15:00'),
      estimatedMinutes: 180,
      status: 'in-progress',
    },
    {
      id: 'a-sorting-visualizer',
      classId: 'cs',
      title: 'Project Milestone: Sorting Visualizer',
      description: 'Implement merge sort and quick sort animations.',
      dueAt: daysFromNow(now, 9, '15:00'),
      estimatedMinutes: 300,
      status: 'not-started',
    },
    {
      id: 'a-lab-safety-quiz',
      classId: 'chem',
      title: 'Lab Safety Quiz',
      description: 'Open-note quiz on lab safety procedures.',
      dueAt: daysFromNow(now, -1, '09:00'),
      estimatedMinutes: 20,
      status: 'done',
    },
  ]
}

function eventAt(
  id: string,
  title: string,
  now: Date,
  dayOffset: number,
  startHHmm: string,
  minutes: number,
): CalendarEvent {
  const start = dateAtMinutes(addDays(startOfDay(now), dayOffset), toMinutes(startHHmm))
  return {
    id,
    title,
    start: start.toISOString(),
    end: addMinutes(start, minutes).toISOString(),
    kind: 'personal',
    editable: true,
  }
}

export function createMockPersonalEvents(now: Date): CalendarEvent[] {
  return [
    eventAt('e-soccer-1', 'Soccer Practice', now, 0, '16:30', 90),
    eventAt('e-dentist', 'Dentist Appointment', now, 1, '14:00', 60),
    eventAt('e-family-dinner', "Family Dinner — Grandma's Birthday", now, 2, '18:00', 90),
    eventAt('e-job-shift', 'Part-Time Job Shift', now, 3, '15:30', 210),
    eventAt('e-robotics', 'Robotics Club', now, 5, '15:30', 90),
    eventAt('e-soccer-2', 'Soccer Practice', now, 7, '16:30', 90),
  ]
}

export function weekdayEnabledDefault(day: Weekday): boolean {
  return DEFAULT_SCHOOL_HOURS[day].enabled
}
