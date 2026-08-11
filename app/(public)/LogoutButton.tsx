'use client'

export function LogoutButton() {
  return (
    <a
      href="/api/auth/signout"
      className="text-xs font-data uppercase tracking-[0.1em] text-primary-foreground/60 hover:text-accent transition-colors cursor-pointer"
    >
      Sign Out
    </a>
  )
}
