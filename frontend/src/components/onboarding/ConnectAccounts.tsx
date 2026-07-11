import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Check, GraduationCap } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { openGoogleAuthPopup } from '../../lib/api'
import Button from '../ui/Button'
import s from '../views.module.css'

export default function ConnectAccounts() {
  const { connectAccounts } = useApp()
  const nav = useNavigate()
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'syncing' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const next = async () => {
    setSyncing(true)
    setStatus('connecting')
    setErrorMsg('')

    const result = await openGoogleAuthPopup()

    if (!result.success) {
      setStatus('error')
      setErrorMsg(result.error || 'Google authentication failed.')
      setSyncing(false)
      return
    }

    setStatus('syncing')
    await connectAccounts()
    setSyncing(false)
    nav('/onboarding/school-hours')
  }

  return (
    <div className={s.centered}>
      <main className={s.onboarding}>
        <div className={s.steps}>
          <span className={s.stepActive}>Connect</span>
          <span className={s.stepLine} />
          <span>School hours</span>
          <span className={s.stepLine} />
          <span>Your plan</span>
        </div>
        <h1 className={s.display}>Bring your school life into one place.</h1>
        <p className={s.muted} style={{ marginTop: 12 }}>
          Priority:One reads these sources to build and continuously adjust your plan.
        </p>
        <div className={s.connectList}>
          <div className={s.connectRow}>
            <span className={s.serviceIcon}>
              <CalendarDays />
            </span>
            <div className={s.connectCopy}>
              <strong>Google Calendar</strong>
              <span>Works around classes, appointments, practices, and plans.</span>
            </div>
            <span className={s.connected}>
              <Check size={15} /> Ready
            </span>
          </div>
          <div className={s.connectRow}>
            <span className={s.serviceIcon}>
              <GraduationCap />
            </span>
            <div className={s.connectCopy}>
              <strong>Google Classroom</strong>
              <span>Imports assignments, deadlines, class details, and updates.</span>
            </div>
            <span className={s.connected}>
              <Check size={15} /> Ready
            </span>
          </div>
        </div>
        {errorMsg && (
          <p style={{ color: 'var(--color-danger, #e5484d)', fontSize: 14, marginTop: 8 }}>
            {errorMsg}
          </p>
        )}
        <div className={s.actions}>
          <Button onClick={next} disabled={syncing}>
            {syncing
              ? status === 'connecting'
                ? 'Waiting for Google…'
                : 'Syncing…'
              : 'Connect both and continue'}
          </Button>
        </div>
      </main>
    </div>
  )
}
