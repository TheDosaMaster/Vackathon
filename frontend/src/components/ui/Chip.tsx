import type { ReactNode } from 'react'
import styles from './Chip.module.css'

type ChipTone = 'default' | 'risk' | 'done' | 'progress'

export default function Chip({ tone = 'default', children }: { tone?: ChipTone; children: ReactNode }) {
  return <span className={`${styles.chip} ${styles[tone]}`}>{children}</span>
}
