'use client'

import { ContractWithCustomer, ContractServiceDate } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import Link from 'next/link'
import { formatDueMonth } from '@/lib/contracts/service-dates'

interface Props {
  contract: ContractWithCustomer & { contract_service_dates: ContractServiceDate[] }
  isOverdue?: boolean
}

function getNextServiceDue(dates: ContractServiceDate[]): string | null {
  const todayMonth = new Date().toISOString().slice(0, 7)
  const upcoming = dates
    .filter((d) => d.due_month >= todayMonth && !d.booking_id)
    .sort((a, b) => a.due_month.localeCompare(b.due_month))
  return upcoming[0]?.due_month ?? null
}

function isServiceDueThisMonth(dates: ContractServiceDate[]): boolean {
  const prefix = new Date().toISOString().slice(0, 7)
  return dates.some((d) => d.due_month === prefix && !d.booking_id && !d.reminder_sent)
}

function isExpiringSoon(endDate: string): boolean {
  const end = new Date(endDate)
  const in30 = new Date()
  in30.setDate(in30.getDate() + 30)
  return end <= in30
}

export default function ContractCard({ contract, isOverdue }: Props) {
  const nextDue = getNextServiceDue(contract.contract_service_dates)
  const dueBadge = isServiceDueThisMonth(contract.contract_service_dates)
  const expiringSoon = contract.status === 'ACTIVE' && isExpiringSoon(contract.end_date)
  const isPending = contract.status === 'PENDING_REVIEW' || contract.status === 'AWAITING_PAYMENT'

  const statusColors: Record<string, string> = {
    PENDING_REVIEW: 'bg-amber-100 text-amber-800',
    AWAITING_PAYMENT: 'bg-orange-100 text-orange-800',
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-muted text-muted-foreground',
    CANCELLED: 'bg-red-100 text-red-700',
  }

  const statusLabels: Record<string, string> = {
    PENDING_REVIEW: 'Pending Review',
    AWAITING_PAYMENT: 'Awaiting Payment',
    ACTIVE: 'ACTIVE',
    EXPIRED: 'EXPIRED',
    CANCELLED: 'CANCELLED',
  }

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-primary">{contract.customer.name}</p>
            <p className="text-sm text-muted-foreground">{contract.customer.phone}</p>
            {contract.address && (
              <p className="text-xs text-muted-foreground mt-0.5">{contract.address}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-1 justify-end">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[contract.status]}`}>
              {statusLabels[contract.status] ?? contract.status}
            </span>
            {dueBadge && (
              <Badge className="bg-amber-100 text-amber-800 text-xs">Service Due</Badge>
            )}
            {isOverdue && (
              <Badge className="bg-destructive text-destructive-foreground text-xs">Overdue</Badge>
            )}
            {expiringSoon && (
              <Badge className="bg-red-100 text-red-700 text-xs">Expiring Soon</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-1 text-sm text-foreground">
        <p>{contract.num_units} unit{contract.num_units !== 1 ? 's' : ''} · {contract.price_sgd != null ? `S$${Number(contract.price_sgd).toFixed(2)}/yr` : 'Price TBD'}</p>
        <p>
          {contract.start_date} → {contract.end_date}
        </p>
        {nextDue && (
          <p className="text-amber-700 font-medium">Next service due: {formatDueMonth(nextDue)}</p>
        )}
        {contract.notes && (
          <p className="text-muted-foreground italic">{contract.notes}</p>
        )}
        <div className="pt-2 flex gap-2 flex-wrap">
          <Link href={`/admin/contracts/${contract.id}`}>
            <Button size="sm" variant="outline">View Details</Button>
          </Link>
          {(contract.status === 'AWAITING_PAYMENT' || contract.status === 'ACTIVE') && (
            <a href={`/api/contracts/${contract.id}/pdf`} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">Preview PDF</Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
