import { forwardRef, type ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'ghost' | 'danger'
type Size = 'md' | 'sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => {
    const classes = [styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ')
    return <button ref={ref} className={classes} {...props} />
  },
)

Button.displayName = 'Button'
export default Button
