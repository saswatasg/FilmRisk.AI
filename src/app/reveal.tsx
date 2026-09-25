'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/* Scroll-triggered entrance: fades + rises once when the section enters view.
   Disabled automatically for reduced-motion users via the global media query. */
export function Reveal({ children, className, delay = 0 }: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState<boolean>(
    () => typeof window === 'undefined' || typeof IntersectionObserver === 'undefined'
  )

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    const io = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(20px)',
        transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}
