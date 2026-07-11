import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, CheckSquare, LayoutGrid, LogOut, Settings as SettingsIcon } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import VachanPanel from '../vachan/VachanPanel'
import styles from './AppShell.module.css'

const NAV_ITEMS = [
  { to: '/today', label: 'Today', icon: LayoutGrid },
  { to: '/week', label: 'This week', icon: CalendarDays },
  { to: '/assignments', label: 'Assignments', icon: CheckSquare },
]

export default function AppShell() {
  const { studentName, signOut } = useApp()
  const [vachanOpen, setVachanOpen] = useState(false)

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>P:1</span>
          <span className={styles.brandName}>Priority:One</span>
        </div>

        <nav className={styles.nav} aria-label="Main">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <Icon size={17} strokeWidth={2} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <NavLink
            to="/settings"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
          >
            <SettingsIcon size={17} strokeWidth={2} aria-hidden="true" />
            Settings
          </NavLink>
          <div className={styles.account}>
            <div className={styles.avatar} aria-hidden="true">
              {studentName.charAt(0).toUpperCase()}
            </div>
            <span className={styles.accountName}>{studentName}</span>
            <button className={styles.signOut} onClick={signOut} aria-label="Sign out">
              <LogOut size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>

      <button
        type="button"
        className={styles.vachanLauncher}
        onClick={() => setVachanOpen((v) => !v)}
        aria-expanded={vachanOpen}
        aria-controls="vachan-panel"
      >
        <span className={styles.vachanMark}>v</span>
        <span className={styles.vachanLabel}>Vachan</span>
      </button>

      <VachanPanel open={vachanOpen} onClose={() => setVachanOpen(false)} />
    </div>
  )
}
