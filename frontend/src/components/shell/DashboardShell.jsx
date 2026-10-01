import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

function NavRow({ item, collapsed, indent = false, onClose }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClose}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg py-2.5 pr-3 text-sm font-semibold transition-[background-color,color,padding] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-inset ${
          indent ? 'pl-9' : 'pl-3'
        } ${collapsed ? 'lg:pl-[31px]' : ''} ${
          isActive ? 'bg-brand-50 text-brand-800' : 'text-body hover:bg-surface hover:text-ink'
        }`
      }
    >
      <span className="relative shrink-0">
        <item.icon size={18} />
        {item.badge > 0 ? (
          <span
            className={`absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand-600 transition-opacity duration-200 ${
              collapsed ? 'lg:opacity-100' : 'lg:opacity-0'
            }`}
          />
        ) : null}
      </span>

      <span
        className={`flex-1 whitespace-nowrap transition-opacity duration-200 ${
          collapsed ? 'lg:opacity-0' : 'opacity-100'
        }`}
      >
        {item.label}
      </span>

      {item.badge > 0 ? (
        <span
          className={`rounded-full bg-brand-700 px-2 py-0.5 text-xs font-bold text-white transition-opacity duration-200 ${
            collapsed ? 'lg:opacity-0' : 'opacity-100'
          }`}
        >
          {item.badge}
        </span>
      ) : null}
    </NavLink>
  )
}

export default function DashboardShell({
  nav,
  brandChip,
  storageKey,
  userEmail,
  onSignout,
  topbarExtra = null,
  children,
}) {
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => window.localStorage.getItem(`aurora.shell.${storageKey}`) === 'collapsed',
  )

  useEffect(() => {
    if (!drawerOpen) return undefined

    const handleKey = (event) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [drawerOpen])

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(`aurora.shell.${storageKey}`, next ? 'collapsed' : 'expanded')
      return next
    })
  }

  const entries = nav.flatMap((entry) => (entry.items ? entry.items : [entry]))
  const activeItem = entries.find((entry) =>
    entry.end ? location.pathname === entry.to : location.pathname.startsWith(entry.to),
  )

  const close = () => setDrawerOpen(false)

  return (
    <div className="min-h-screen bg-white">
      {drawerOpen ? (
        <div
          aria-hidden="true"
          onClick={close}
          className="fixed inset-0 z-30 bg-brand-950/20 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-hidden border-r border-line bg-white transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] print:hidden lg:translate-x-0 lg:transition-[width] lg:duration-300 lg:ease-[cubic-bezier(0.23,1,0.32,1)] ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        <div className="flex h-full w-64 flex-col">
          <div className="relative flex h-16 shrink-0 items-center border-b border-line px-3">
            <span
              className={`flex items-center gap-2 transition-opacity duration-200 ${
                collapsed ? 'lg:pointer-events-none lg:opacity-0' : 'opacity-100'
              }`}
            >
              <Link to={entries[0]?.to ?? '/'} className="flex items-center">
                <img src="/Aurora.png" alt="Aurora" className="h-8 w-auto" />
              </Link>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800">
                {brandChip}
              </span>
            </span>

            <span
              aria-hidden="true"
              className={`absolute left-3 grid h-9 w-9 place-items-center rounded-xl bg-brand-950 text-sm font-extrabold text-brand-300 transition-opacity duration-200 ${
                collapsed ? 'lg:opacity-100' : 'lg:opacity-0'
              }`}
            >
              A
            </span>
          </div>

          <nav className="flex-1 overflow-y-auto p-3">
            {nav.map((entry, index) =>
              entry.items ? (
                <div key={entry.label} className={index === 0 ? '' : 'mt-4'}>
                  <p
                    className={`flex items-center gap-2 px-3 pb-2 text-xs font-bold uppercase tracking-widest text-mist transition-opacity duration-200 ${
                      collapsed ? 'lg:opacity-0' : 'opacity-100'
                    }`}
                  >
                    <entry.icon size={14} />
                    <span className="whitespace-nowrap">{entry.label}</span>
                  </p>

                  <div className="space-y-1">
                    {entry.items.map((child) => (
                      <NavRow
                        key={child.to}
                        item={child}
                        collapsed={collapsed}
                        indent
                        onClose={close}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <NavRow
                  key={entry.to}
                  item={entry}
                  collapsed={collapsed}
                  onClose={close}
                />
              ),
            )}
          </nav>

          <div className="shrink-0 border-t border-line p-3">
            <p
              className={`mb-1 truncate px-3 text-xs text-mist transition-opacity duration-200 ${
                collapsed ? 'lg:opacity-0' : 'opacity-100'
              }`}
            >
              {userEmail}
            </p>
            <button
              type="button"
              onClick={onSignout}
              title={collapsed ? 'Sign out' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-body transition-[background-color,color,padding] duration-300 hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-inset ${
                collapsed ? 'lg:pl-[31px]' : ''
              }`}
            >
              <LogOut size={18} className="shrink-0" />
              <span
                className={`whitespace-nowrap transition-opacity duration-200 ${
                  collapsed ? 'lg:opacity-0' : 'opacity-100'
                }`}
              >
                Sign out
              </span>
            </button>
          </div>
        </div>
      </aside>

      <div
        className={`flex min-h-screen flex-col print:pl-0 ${
          collapsed ? 'lg:pl-20' : 'lg:pl-64'
        } lg:transition-[padding] lg:duration-300 lg:ease-[cubic-bezier(0.23,1,0.32,1)]`}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line bg-white/80 px-4 backdrop-blur-xl print:hidden sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line text-body transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 lg:hidden"
            >
              <Menu size={18} />
            </button>

            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              className="hidden h-10 w-10 items-center justify-center rounded-lg border border-line text-body transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 lg:inline-flex"
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>

            <span className="text-sm font-semibold text-ink">{activeItem?.label ?? brandChip}</span>
          </div>

          <div className="flex items-center gap-4">
            {topbarExtra}
            <span className="hidden text-sm text-mist sm:block">{userEmail}</span>
          </div>
        </header>

        <main className="flex-1 px-4 py-8 print:p-0 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
