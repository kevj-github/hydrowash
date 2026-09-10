'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDeleteModal } from '@/components/admin/ConfirmDeleteModal'
import { Trash2 } from 'lucide-react'

interface CustomerRow {
  id: string
  name: string
  phone: string
  customer_no: number | null
}

interface Props {
  customers: CustomerRow[]
  bookingCounts: Record<string, number>
  invoiceTotals: Record<string, number>
  activeContractIds: string[]
}

export function AdminCustomersClient({ customers, bookingCounts, invoiceTotals, activeContractIds }: Props) {
  const supabase = createClient()
  const activeContracts = useMemo(() => new Set(activeContractIds), [activeContractIds])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [singleDeleteCustomer, setSingleDeleteCustomer] = useState<CustomerRow | null>(null)
  const [dependentCounts, setDependentCounts] = useState<{ bookings: number; contracts: number; invoices: number } | null>(null)

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allVisibleSelected = customers.length > 0 && customers.every(c => selectedIds.has(c.id))

  function toggleSelectAllVisible() {
    setSelectedIds(prev => allVisibleSelected ? new Set() : new Set(customers.map(c => c.id)))
  }

  const deleteModalItems = useMemo(() => {
    if (singleDeleteCustomer) {
      return [{ id: singleDeleteCustomer.id, label: `${singleDeleteCustomer.name} — ${singleDeleteCustomer.phone}` }]
    }
    return customers
      .filter(c => selectedIds.has(c.id))
      .map(c => ({ id: c.id, label: `${c.name} — ${c.phone}` }))
  }, [singleDeleteCustomer, selectedIds, customers])

  async function loadDependentCounts(ids: string[]) {
    const [bookingsRes, contractsRes, invoicesRes] = await Promise.all([
      supabase.from('bookings').select('id', { count: 'exact', head: true }).in('customer_id', ids),
      supabase.from('contracts').select('id', { count: 'exact', head: true }).in('customer_id', ids),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).in('customer_id', ids),
    ])
    setDependentCounts({
      bookings: bookingsRes.count ?? 0,
      contracts: contractsRes.count ?? 0,
      invoices: invoicesRes.count ?? 0,
    })
  }

  async function openSingleDelete(customer: CustomerRow) {
    setSingleDeleteCustomer(customer)
    await loadDependentCounts([customer.id])
  }

  async function openBulkDelete() {
    setDeleteModalOpen(true)
    await loadDependentCounts(Array.from(selectedIds))
  }

  const warning = dependentCounts && (dependentCounts.bookings + dependentCounts.contracts + dependentCounts.invoices > 0)
    ? `This will also permanently delete ${dependentCounts.bookings} booking${dependentCounts.bookings === 1 ? '' : 's'}, ${dependentCounts.contracts} contract${dependentCounts.contracts === 1 ? '' : 's'}, and ${dependentCounts.invoices} invoice${dependentCounts.invoices === 1 ? '' : 's'}.`
    : undefined

  async function handleConfirmDelete() {
    const ids = singleDeleteCustomer ? [singleDeleteCustomer.id] : Array.from(selectedIds)
    const res = await fetch('/api/customers/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Delete failed')
    }
    const body = await res.json()
    if (body.failed?.length) {
      throw new Error(`${body.failed.length} of ${ids.length} customers could not be deleted`)
    }
    setSingleDeleteCustomer(null)
    setSelectedIds(new Set())
    setDependentCounts(null)
    window.location.reload()
  }

  if (!customers.length) {
    return <p className="text-muted-foreground text-sm">No customers found.</p>
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAllVisible} aria-label="Select all visible customers" />
          Select all
        </label>
        {selectedIds.size > 0 && (
          <button
            onClick={openBulkDelete}
            className="text-xs font-medium bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg"
          >
            Delete {selectedIds.size} Selected
          </button>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 w-8">
                <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAllVisible} aria-label="Select all visible customers" />
              </th>
              <th className="text-left px-4 py-3">No.</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-right px-4 py-3">Bookings</th>
              <th className="text-right px-4 py-3">Total Paid</th>
              <th className="text-center px-4 py-3">Contract</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-accent/5 transition-colors">
                <td className="px-4 py-3">
                  <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} aria-label={`Select ${c.name}`} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.customer_no ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-accent/10 text-accent font-semibold text-sm flex items-center justify-center shrink-0">
                      {c.name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <Link href={`/admin/customers/${c.id}`} className="font-medium text-primary hover:text-accent">
                      {c.name}
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone}</td>
                <td className="px-4 py-3 text-right">{bookingCounts[c.id] ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  {invoiceTotals[c.id] ? `S$${invoiceTotals[c.id].toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {activeContracts.has(c.id) ? (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-semibold">Active</span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/admin/customers/${c.id}`} className="text-accent hover:underline text-xs font-medium">
                      View →
                    </Link>
                    <button onClick={() => openSingleDelete(c)} aria-label={`Delete ${c.name}`} className="text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {customers.map(c => (
          <div key={c.id} className="bg-white border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} aria-label={`Select ${c.name}`} />
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm shrink-0">
                  {c.name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeContracts.has(c.id) && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Contract</span>
                )}
                <button onClick={() => openSingleDelete(c)} aria-label={`Delete ${c.name}`} className="text-slate-400 hover:text-red-600 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{bookingCounts[c.id] ?? 0} bookings</span>
              <span>Total {invoiceTotals[c.id] ? `S$${invoiceTotals[c.id].toFixed(2)}` : '—'}</span>
            </div>
            <Link href={`/admin/customers/${c.id}`} className="block text-xs text-accent font-medium">View →</Link>
          </div>
        ))}
      </div>

      <ConfirmDeleteModal
        open={deleteModalOpen || !!singleDeleteCustomer}
        onOpenChange={(open) => { if (!open) { setDeleteModalOpen(false); setSingleDeleteCustomer(null); setDependentCounts(null) } }}
        title={singleDeleteCustomer ? 'Delete Customer' : `Delete ${selectedIds.size} Customers`}
        items={deleteModalItems}
        warning={warning}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
