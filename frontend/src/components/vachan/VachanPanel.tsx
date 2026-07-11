import { useMemo, useState } from 'react'
import { Send, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { greeting, respond } from '../../lib/vachan'
import { sendChatMessage } from '../../lib/api'
import { isSameDay } from '../../lib/date'
import Button from '../ui/Button'
import s from '../views.module.css'

type Message = { role: 'bot' | 'user'; text: string }

export default function VachanPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp()
  const ctx = useMemo(() => ({
    studentName: app.studentName,
    now: app.now,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    todaySessions: app.schedule.workSessions.filter((event) => isSameDay(new Date(event.start), app.now)),
    atRiskAssignments: app.assignments.filter((assignment) => app.schedule.atRisk.has(assignment.id)),
    assignments: app.assignments.map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      dueAt: assignment.dueAt,
      status: assignment.status,
      priorityScore: assignment.priorityScore,
      priorityReason: assignment.priorityReason,
    })),
    personalEvents: app.personalEvents.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
    })),
    workSessions: app.schedule.workSessions.slice(0, 20),
    schoolHours: app.schoolHours,
    sleepWindow: app.sleepWindow,
  }), [app])
  const [messages, setMessages] = useState<Message[]>(() => [{ role: 'bot', text: greeting(ctx) }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  if (!open) return null

  const send = async () => {
    if (!input.trim() || sending) return
    const question = input.trim()
    const nextMessages: Message[] = [...messages, { role: 'user', text: question }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    try {
      const reply = await sendChatMessage(question, ctx, nextMessages)
      if (reply.calendarChanged) await app.syncCalendar()
      setMessages((current) => [...current, { role: 'bot', text: reply.text }])
    } catch {
      const reply = respond(question, ctx)
      setMessages((current) => [...current, { role: 'bot', text: reply.text }])
    } finally {
      setSending(false)
    }
  }

  return <>
    <button className={s.chatBackdrop} aria-label="Close Vachan" onClick={onClose} />
    <aside id="vachan-panel" className={s.chat} aria-label="Vachan support">
      <header className={s.chatHeader}>
        <span className={s.vmark}>v</span>
        <div><strong>Vachan</strong><br /><small>Support and real calendar help</small></div>
        <button onClick={onClose} aria-label="Close"><X /></button>
      </header>
      <div className={s.messages} aria-live="polite">
        {messages.map((message, index) => <div key={index} className={`${s.message} ${message.role === 'bot' ? s.bot : s.user}`}>{message.text}</div>)}
        {sending && <div className={`${s.message} ${s.bot}`}>Looking at your schedule…</div>}
      </div>
      <form className={s.chatForm} onSubmit={(event) => { event.preventDefault(); void send() }}>
        <input className={s.input} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask for support or a calendar change…" aria-label="Message Vachan" />
        <Button size="sm" type="submit" aria-label="Send" disabled={sending}><Send size={16} /></Button>
      </form>
    </aside>
  </>
}
