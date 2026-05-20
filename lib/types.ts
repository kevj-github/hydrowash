export type UserRole = 'customer' | 'admin'
export type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
export type BookingCategory = 'MAINTENANCE' | 'FAULT_REPAIR' | 'INSTALLATION'
export type TimeSlot = 'S10_12' | 'S13_15' | 'S15_17' | 'S17_19' | 'S19_21'
export type Urgency = 'HIGH' | 'MEDIUM' | 'LOW'

export interface PreferredDateSlot {
  date: string
  slots: TimeSlot[]
}

export const SLOT_LABELS: Record<TimeSlot, string> = {
  S10_12: '10:00 – 12:00',
  S13_15: '13:00 – 15:00',
  S15_17: '15:00 – 17:00',
  S17_19: '17:00 – 19:00',
  S19_21: '19:00 – 21:00',
}

export const SLOT_KEYS = Object.keys(SLOT_LABELS) as TimeSlot[]

export interface Profile {
  id: string
  name: string
  phone: string
  role: UserRole
  address: string | null
  address_lat: number | null
  address_lng: number | null
  postal_code: string | null
  created_at: string
}

export interface ServiceType {
  id: string
  name: string
  category: BookingCategory
  description: string
  duration_minutes: number | null
  price_sgd: number | null
  active: boolean
  created_at: string
}

export interface Booking {
  id: string
  customer_id: string
  category: BookingCategory
  service_type_id: string
  address: string
  postal_code: string
  lat: number
  lng: number
  booking_date: string
  time_slot: TimeSlot           // first preferred slot (backward compat)
  preferred_slots: TimeSlot[]   // all customer availability preferences (1–3)
  preferred_date_slots: PreferredDateSlot[]
  confirmed_slot: TimeSlot | null  // admin-confirmed slot (set on approval)
  num_units: number | null
  fault_description: string | null
  urgency: Urgency | null
  ac_brand: string | null
  ac_model: string | null
  notes: string | null
  media_urls: string[]
  status: BookingStatus
  confirmed_date: string | null
  rejection_reason: string | null
  created_at: string
}

export interface BookingWithRelations extends Booking {
  customer: Pick<Profile, 'name' | 'phone'>
  service_type: Pick<ServiceType, 'name' | 'duration_minutes' | 'price_sgd'>
}

export interface RouteStop {
  bookingId: string
  sequenceOrder: number
  estimatedStart: string
  estimatedEnd: string
  travelFromPrevMinutes: number
  lat: number
  lng: number
  customerName: string
  address: string
  serviceType: string
  durationMinutes: number
  timeSlot: TimeSlot
  notes: string | null
}

export interface AppSettings {
  depot_address: string
  depot_lat: number
  depot_lng: number
  company_name: string
  contact_email: string
  paynow_mobile: string | null
  contract_pricing_tiers: ContractPricingTier[]
}

// ============================================================
// Phase 1B — Contracts & Invoices
// ============================================================

export type ContractStatus = 'PENDING_REVIEW' | 'AWAITING_PAYMENT' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'

export interface Contract {
  id: string
  customer_id: string
  num_units: number
  price_sgd: number | null
  start_date: string
  end_date: string
  service_interval_months: number
  address: string | null
  notes: string | null
  status: ContractStatus
  expiry_reminder_sent: boolean
  created_at: string
}

export interface ContractWithCustomer extends Contract {
  customer: {
    id: string
    name: string
    phone: string
  }
}

export interface ContractWithDetails extends ContractWithCustomer {
  contract_service_dates: ContractServiceDate[]
  invoices: Invoice[]
}

export interface ContractServiceDate {
  id: string
  contract_id: string
  due_date: string
  reminder_sent: boolean
  booking_id: string | null
}

export interface ContractServiceDateWithBooking extends ContractServiceDate {
  booking: {
    id: string
    status: string
    confirmed_date: string | null
    address: string
  } | null
}

export type InvoiceStatus = 'UNPAID' | 'PAID'

export type PaymentMethod = 'Cash' | 'PayNow' | 'Bank Transfer' | 'Other'

export interface Invoice {
  id: string
  customer_id: string
  booking_id: string | null
  contract_id: string | null
  amount_sgd: number
  description: string
  status: InvoiceStatus
  payment_method: PaymentMethod | null
  paid_at: string | null
  created_at: string
}

export interface InvoiceWithCustomer extends Invoice {
  customer: {
    id: string
    name: string
    phone: string
  }
}

export interface CreateContractPayload {
  customer_id: string
  num_units: number
  price_sgd: number
  start_date: string
  address?: string
  notes?: string
}

export interface LinkBookingPayload {
  service_date_id: string
  booking_id: string
}

export interface CreateInvoicePayload {
  customer_id: string
  booking_id?: string
  contract_id?: string
  amount_sgd: number
  description: string
}

export interface MarkInvoicePaidPayload {
  payment_method: PaymentMethod
}

// ============================================================
// Phase 2 — Slot model, availability, AC catalog
// ============================================================

export interface AcUnitLocation {
  id: string
  label: string
  display_order: number
  is_active: boolean
  created_at: string
}

export interface AcUnitType {
  id: string
  label: string
  display_order: number
  is_active: boolean
  created_at: string
}

export interface AcBrand {
  id: string
  label: string
  display_order: number
  is_active: boolean
  created_at: string
}

export interface BlockedSlot {
  id: string
  blocked_date: string
  slot: TimeSlot | null   // null = full-day block
  reason: string | null
  created_at: string
}

export interface ContractPricingTier {
  min_units: number
  max_units: number | null  // null = unlimited; total = price_sgd × unit_count
  price_sgd: number
}
