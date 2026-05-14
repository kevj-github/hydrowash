'use client'

import { ContractWithCustomer, ContractServiceDate } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import Link from 'next/link'

interface Props {
  contract: ContractWithCustomer & { contract_service_dates: ContractServiceDate[] }
}

function getNextServiceDue(dates: ContractServiceDate[]): string | null {
  const today = new Date().toISOString().split('T')[0]
  const upcoming = dates
    .filter((d) => d.due_date >= today && !d.booking_id)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
  return upcoming[0]?.due_date ?? null
}

function isServiceDueThisMonth(dates: ContractServiceDate[]): boolean {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `${year}-${month}`
  return dates.some((d) => d.due_date.startsWith(prefix) && !d.booking_id && !d.reminder_sent)
}

function isExpiringSoon(endDate: string): boolean {
  const end = new Date(endDate)
  const in30 = new Date()
  in30.setDate(in30.getDate() + 30)
  return end <= in30
}

export default function ContractCard({ contract }: Props) {
  const nextDue = getNextServiceDue(contract.contract_service_dates)
  const dueBadge = isServiceDueThisMonth(contract.contract_service_dates)
  const expiringSoon = contract.status === 'ACTIVE' && isExpiringSoon(contract.end_date)

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-muted text-muted-foreground',
    CANCELLED: 'bg-red-100 text-red-700',
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
              {contract.status}
            </span>
            {dueBadge && (
              <Badge className="bg-amber-100 text-amber-800 text-xs">Service Due</Badge>
            )}
            {expiringSoon && (
              <Badge className="bg-red-100 text-red-700 text-xs">Expiring Soon</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-1 text-sm text-foreground">
        <p>{contract.num_units} unit{contract.num_units !== 1 ? 's' : ''} · S${contract.price_sgd.toFixed(2)}/yr</p>
        <p>
          {contract.start_date} → {contract.end_date}
        </p>
        {nextDue && (
          <p className="text-amber-700 font-medium">Next service due: {nextDue}</p>
        )}
        {contract.notes && (
          <p className="text-muted-foreground italic">{contract.notes}</p>
        )}
        <div className="pt-2">
          <Link href={`/admin/contracts/${contract.id}`}>
            <Button size="sm" variant="outline">View Details</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
