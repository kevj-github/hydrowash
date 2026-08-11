'use client'

export function LogoutButton() {
  return (
    <a
      href="/api/auth/signout"
      className="text-sm text-slate-300 hover:text-white transition-colors"
    >
      Sign Out
    </a>
  )
}
