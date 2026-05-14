'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface ServiceDate {
  id: string
  due_date: string
  reminder_sent: boolean
  booking_id: string | null
}

interface Contract {
  id: string
  num_units: number
  price_sgd: number | string
  start_date: string
  end_date: string
  service_interval_months: number
  notes: string | null
  status: string
  contract_service_dates: ServiceDate[]
}

interface Invoice {
  id: string
  amount_sgd: number | string
  description: string
  status: string
  payment_method: string | null
  paid_at: string | null
  created_at: string
}

interface Props {
  contracts: Contract[]
  invoices: Invoice[]
}

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-red-100 text-red-700',
}

export function AccountContractsClient({ contracts, invoices }: Props) {
  const [contractStatus, setContractStatus] = useState('ALL')
  const [invoiceStatus, setInvoiceStatus] = useState('ALL')
  const [invDateFrom, setInvDateFrom] = useState('')
  const [invDateTo, setInvDateTo] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const filteredContracts = contracts.filter(c =>
    contractStatus === 'ALL' || c.status === contractStatus
  )

  const filteredInvoices = invoices.filter(inv => {
    if (invoiceStatus !== 'ALL' && inv.status !== invoiceStatus) return false
    const created = inv.created_at.split('T')[0]
    if (invDateFrom && created < invDateFrom) return false
    if (invDateTo && created > invDateTo) return false
    return true
  })

  const hasInvFilters = invoiceStatus !== 'ALL' || invDateFrom || invDateTo

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10">

      {/* Contracts section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading font-bold text-2xl text-primary">My Contracts</h1>
          <div className="flex gap-2 flex-wrap">
            {['ALL', 'ACTIVE', 'EXPIRED', 'CANCELLED'].map(s => (
              <button
                key={s}
                onClick={() => setContractStatus(s)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  contractStatus === s
                    ? 'bg-accent text-white border-accent'
                    : 'bg-white text-muted-foreground border-border hover:border-accent'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {filteredContracts.length === 0 ? (
          <p className="text-muted-foreground">
            {contracts.length === 0 ? 'You have no maintenance contracts yet.' : 'No contracts match the selected filter.'}
          </p>
        ) : (
          <div className="space-y-6">
            {filteredContracts.map((contract) => {
              const sortedDates = [...(contract.contract_service_dates ?? [])].sort(
                (a, b) => a.due_date.localeCompare(b.due_date)
              )
              return (
                <div key={contract.id} className="bg-white border border-border rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-heading font-semibold text-primary">
                        {contract.num_units} unit{contract.num_units !== 1 ? 's' : ''} — S${Number(contract.price_sgd).toFixed(2)}/yr
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {contract.start_date} → {contract.end_date}
                      </p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${CONTRACT_STATUS_COLORS[contract.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {contract.status}
                    </span>
                  </div>

                  {contract.notes && (
                    <p className="text-sm text-muted-foreground italic">{contract.notes}</p>
                  )}

                  <div>
                    <p className="text-sm font-medium text-primary mb-2">Service Schedule</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b border-border">
                          <th className="py-1 text-left font-medium">Visit</th>
                          <th className="py-1 text-left font-medium">Due Date</th>
                          <th className="py-1 text-left font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedDates.map((sd, i) => {
                          const isPast = sd.due_date < today
                          const isCompleted = !!sd.booking_id
                          return (
                            <tr key={sd.id} className="border-b border-border/50">
                              <td className="py-1.5 text-muted-foreground">Visit {i + 1}</td>
                              <td className="py-1.5 text-primary">{sd.due_date}</td>
                              <td className="py-1.5">
                                {isCompleted ? (
                                  <Badge className="bg-green-100 text-green-800 text-xs">Booked</Badge>
                                ) : isPast ? (
                                  <Badge className="bg-red-100 text-red-700 text-xs">Overdue</Badge>
                                ) : (
                                  <Badge className="bg-slate-100 text-slate-500 text-xs">Upcoming</Badge>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Invoices section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading font-bold text-xl text-primary">My Invoices</h2>
          <div className="flex flex-wrap gap-2 items-center">
            {['ALL', 'UNPAID', 'PAID'].map(s => (
              <button
                key={s}
                onClick={() => setInvoiceStatus(s)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  invoiceStatus === s
                    ? 'bg-accent text-white border-accent'
                    : 'bg-white text-muted-foreground border-border hover:border-accent'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Invoice date range filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1 items-center">
            <span className="text-xs text-muted-foreground">From</span>
            <Input
              type="date"
              value={invDateFrom}
              onChange={e => setInvDateFrom(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <div className="flex gap-1 items-center">
            <span className="text-xs text-muted-foreground">To</span>
            <Input
              type="date"
              value={invDateTo}
              onChange={e => setInvDateTo(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          {hasInvFilters && (
            <button
              onClick={() => { setInvoiceStatus('ALL'); setInvDateFrom(''); setInvDateTo('') }}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Clear
            </button>
          )}
        </div>

        {filteredInvoices.length === 0 ? (
          <p className="text-muted-foreground">
            {invoices.length === 0 ? 'No invoices on record.' : 'No invoices match the selected filters.'}
          </p>
        ) : (
          <div className="bg-white border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-border">
                <tr className="text-xs text-muted-foreground">
                  <th className="py-2.5 px-3 font-medium">Description</th>
                  <th className="py-2.5 px-3 font-medium">Amount</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 px-3 max-w-xs truncate text-primary">{inv.description}</td>
                    <td className="py-2.5 px-3 font-medium text-primary">S${Number(inv.amount_sgd).toFixed(2)}</td>
                    <td className="py-2.5 px-3">
                      {inv.status === 'PAID' ? (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          Paid {inv.payment_method ? `(${inv.payment_method})` : ''}
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 text-xs">Unpaid</Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {inv.created_at.split('T')[0]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
