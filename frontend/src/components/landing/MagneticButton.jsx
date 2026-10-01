import { useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

const TRANSITION =
  'transform 0.15s cubic-bezier(0.23, 1, 0.32, 1), translate 300ms ease, scale 300ms ease, background-color 300ms ease, border-color 300ms ease, color 300ms ease, box-shadow 300ms ease'

export default function MagneticButton({ children, className = '', onClick, type = 'button' }) {
  const ref = useRef(null)
  const offset = useRef({ x: 0, y: 0 })
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const reduceMotion = useReducedMotion()

  const handleMouseMove = (event) => {
    if (reduceMotion || !ref.current) return

    const rect = ref.current.getBoundingClientRect()
    const baseLeft = rect.left - offset.current.x
    const baseTop = rect.top - offset.current.y
    const x = (event.clientX - (baseLeft + rect.width / 2)) * 0.3
    const y = (event.clientY - (baseTop + rect.height / 2)) * 0.3

    offset.current = { x, y }
    setPosition({ x, y })
  }

  const reset = () => {
    offset.current = { x: 0, y: 0 }
    setPosition({ x: 0, y: 0 })
  }

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={reset}
      className={className}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: TRANSITION,
      }}
    >
      {children}
    </button>
  )
}
