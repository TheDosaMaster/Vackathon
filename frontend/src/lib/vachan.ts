import type { Assignment, CalendarEvent } from '../types'

export interface VachanContext {
  studentName: string
  now: Date
  todaySessions: CalendarEvent[]
  atRiskAssignments: Assignment[]
}

export interface VachanReply {
  text: string
  action?: 'add-break'
}

function timeOfDayGreeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function greeting(ctx: VachanContext): string {
  const hello = timeOfDayGreeting(ctx.now)
  if (ctx.atRiskAssignments.length > 0) {
    const first = ctx.atRiskAssignments[0]
    return `${hello}, ${ctx.studentName}. Heads up — "${first.title}" is genuinely tight on time. I can talk through it with you, or we can just sit with how that feels for a second.`
  }
  if (ctx.todaySessions.length > 0) {
    return `${hello}, ${ctx.studentName}. You've got ${ctx.todaySessions.length} work session${
      ctx.todaySessions.length > 1 ? 's' : ''
    } lined up today, and everything's on track. How are you feeling about it?`
  }
  return `${hello}, ${ctx.studentName}. Nothing's scheduled for you today — a good day to breathe. I'm here if you need anything.`
}

export function respond(input: string, ctx: VachanContext): VachanReply {
  const q = input.toLowerCase()

  if (/(stress|overwhelm|anxious|panick|can'?t|too much|drowning)/.test(q)) {
    return {
      text: "That's a lot to carry at once. Let's shrink it down to just the next hour instead of the whole week. Want me to slot a short recharge break into today so you're not running on empty?",
      action: 'add-break',
    }
  }

  if (/(break|tired|rest|nap|burnt out|burned out)/.test(q)) {
    return {
      text: "Good instinct — that matters as much as the homework does. I can hold a 30-minute recharge window for you today. Want me to add it?",
      action: 'add-break',
    }
  }

  if (/(risk|behind|late|worried|falling)/.test(q)) {
    if (ctx.atRiskAssignments.length === 0) {
      return {
        text: "Nothing's actually at risk right now — everything has at least a day of buffer before it's due. You're in good shape.",
      }
    }
    const names = ctx.atRiskAssignments.map((a) => `"${a.title}"`).join(', ')
    return {
      text: `Here's what's genuinely tight right now: ${names}. I've already packed every free minute I can find before the deadline — the rest is something we work through together, not something you carry alone.`,
    }
  }

  if (/(today|plan|schedule|what's next|whats next)/.test(q)) {
    if (ctx.todaySessions.length === 0) return { text: "You're clear today — no work sessions scheduled." }
    const list = ctx.todaySessions.map((s) => `• ${s.title}`).join('\n')
    return { text: `Here's today:\n${list}` }
  }

  if (/(thank|thanks)/.test(q)) {
    return { text: "Anytime. That's what I'm here for." }
  }

  return {
    text: "I hear you. Want me to walk through today's plan, tell you what's genuinely at risk, or find you a short break?",
  }
}
