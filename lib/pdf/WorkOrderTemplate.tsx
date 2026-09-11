import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AcUnitDetail, ChecklistItem, AdditionalCharge } from '@/lib/types'

export interface WorkOrderProps {
  customerName: string
  customerNo: number
  contactNo: string
  address: string
  date: string           // '20/01/2026'
  serviceType: string    // 'AdHoc' | 'Annual Contract'
  visitNo?: number
  totalVisits?: number
  acDetails: AcUnitDetail[]
  checklist: ChecklistItem[]
  jobDescription: string
  jobRendered: string
  remarks: string
  attendedBy: string
  timeArrived: string
  timeCompleted: string
  additionalCharges: AdditionalCharge[]
  basePriceSgd: number
  totalSgd: number
  invoiceStatus: 'PAID' | 'UNPAID'
  paymentMethod: string | null
  paidAt: string | null   // pre-formatted, e.g. '20/01/2026'
  company: { address: string; phone: string; email: string }
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, padding: 30, color: '#1e293b' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-start' },
  logoBox: { backgroundColor: '#0f172a', padding: '7 11', width: 115 },
  logoText: { color: '#ffffff', fontSize: 13, fontFamily: 'Helvetica-Bold' },
  logoSub: { color: '#93c5fd', fontSize: 7, marginTop: 2 },
  companyBlock: { flex: 1, paddingLeft: 14 },
  companyText: { color: '#475569', fontSize: 8, marginBottom: 3 },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 14, textAlign: 'right' },
  // Info grid
  infoTable: { borderWidth: 1, borderColor: '#1e293b', marginBottom: 8 },
  infoRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  infoCell: { padding: '5 7', flex: 1, borderRightWidth: 1, borderRightColor: '#1e293b' },
  infoCellLast: { padding: '5 7', flex: 1 },
  infoLabel: { fontFamily: 'Helvetica-Bold' },
  infoRowLast: { flexDirection: 'row' },
  // Section box (shared bordered container for AC table / job details / bottom row)
  sectionBox: { borderWidth: 1, borderColor: '#1e293b', marginBottom: 8 },
  sectionHeader: { backgroundColor: '#0f172a', padding: '4 7' },
  sectionHeaderText: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 8, textAlign: 'center' },
  // AC table
  acHeaderRow: { flexDirection: 'row', backgroundColor: '#e2e8f0', padding: '4 7' },
  acHeaderCell: { fontFamily: 'Helvetica-Bold', fontSize: 8 },
  acRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e2e8f0', padding: '4 7' },
  acNo: { width: '6%' },
  acBrand: { width: '18%' },
  acModel: { width: '22%' },
  acSerial: { width: '24%' },
  acLocation: { width: '30%' },
  // Checklist + job desc
  twoCol: { flexDirection: 'row' },
  checkCol: { width: '35%', padding: 8, borderRightWidth: 1, borderRightColor: '#1e293b' },
  jobCol: { flex: 1, padding: 8 },
  checkRow: { flexDirection: 'row', marginBottom: 3 },
  checkMarkDone: { width: 40, fontFamily: 'Helvetica-Bold', color: '#0369a1' },
  checkMarkPending: { width: 40, color: '#94a3b8' },
  checkLabel: { flex: 1 },
  sectionLabel: { fontFamily: 'Helvetica-Bold', marginBottom: 4, fontSize: 8, color: '#0369a1' },
  jobText: { lineHeight: 1.5, marginBottom: 8 },
  // Bottom row: attended-by/times | totals + payment status
  bottomRow: { flexDirection: 'row' },
  bottomLeft: { width: '40%', padding: 8, borderRightWidth: 1, borderRightColor: '#1e293b' },
  bottomRight: { flex: 1, padding: 8 },
  bottomLine: { marginBottom: 5 },
  totalText: { fontFamily: 'Helvetica-Bold', fontSize: 15, marginBottom: 6 },
  paymentLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8, marginBottom: 2 },
  paymentValue: { fontSize: 9 },
  chargeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
})

export function WorkOrderTemplate({
  customerName, customerNo, contactNo, address,
  date, serviceType, visitNo, totalVisits,
  acDetails, checklist, jobDescription, jobRendered, remarks,
  attendedBy, timeArrived, timeCompleted,
  additionalCharges, basePriceSgd, totalSgd,
  invoiceStatus, paymentMethod, paidAt,
  company,
}: WorkOrderProps) {
  const visitLabel = visitNo && totalVisits
    ? `Visit ${visitNo} of ${totalVisits}`
    : '—'

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.logoBox}>
            <Text style={s.logoText}>HydroWash</Text>
            <Text style={s.logoSub}>Aircon Service</Text>
          </View>
          <View style={s.companyBlock}>
            <Text style={s.companyText}>{company.address}</Text>
            <Text style={s.companyText}>Tel : {company.phone}</Text>
            <Text style={s.companyText}>Email : {company.email}</Text>
          </View>
          <View>
            <Text style={s.title}>Work Order Report</Text>
          </View>
        </View>

        {/* Customer info grid */}
        <View style={s.infoTable}>
          <View style={s.infoRow}>
            <View style={s.infoCell}>
              <Text><Text style={s.infoLabel}>Customer : </Text>{customerName}</Text>
            </View>
            <View style={s.infoCellLast}>
              <Text><Text style={s.infoLabel}>Date : </Text>{date}</Text>
            </View>
          </View>
          <View style={s.infoRow}>
            <View style={s.infoCell}>
              <Text><Text style={s.infoLabel}>Customer No : </Text>{customerNo}</Text>
            </View>
            <View style={s.infoCellLast}>
              <Text><Text style={s.infoLabel}>Type of service : </Text>{serviceType}</Text>
            </View>
          </View>
          <View style={s.infoRow}>
            <View style={s.infoCell}>
              <Text><Text style={s.infoLabel}>Tel No : </Text>{contactNo}</Text>
            </View>
            <View style={s.infoCellLast}>
              <Text><Text style={s.infoLabel}>No of Service : </Text>{visitLabel}</Text>
            </View>
          </View>
          <View style={s.infoRowLast}>
            <View style={{ padding: '5 7' }}>
              <Text><Text style={s.infoLabel}>Address : </Text>{address}</Text>
            </View>
          </View>
        </View>

        {/* AC System Details */}
        <View style={s.sectionBox}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>Air-Conditioning System Details</Text>
          </View>
          <View style={s.acHeaderRow}>
            <Text style={[s.acHeaderCell, s.acNo]}>No</Text>
            <Text style={[s.acHeaderCell, s.acBrand]}>Brand</Text>
            <Text style={[s.acHeaderCell, s.acModel]}>Model</Text>
            <Text style={[s.acHeaderCell, s.acSerial]}>Serial No</Text>
            <Text style={[s.acHeaderCell, s.acLocation]}>Location</Text>
          </View>
          {acDetails.map((unit, i) => (
            <View key={i} style={s.acRow}>
              <Text style={s.acNo}>{i + 1}</Text>
              <Text style={s.acBrand}>{unit.brand ?? ''}</Text>
              <Text style={s.acModel}>{unit.model ?? ''}</Text>
              <Text style={s.acSerial}>{unit.serial_no ?? ''}</Text>
              <Text style={s.acLocation}>{unit.location ?? ''}</Text>
            </View>
          ))}
        </View>

        {/* Checklist + Job Description */}
        <View style={s.sectionBox}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>Job Details</Text>
          </View>
          <View style={s.twoCol}>
            <View style={s.checkCol}>
              <Text style={s.sectionLabel}>CHECK LIST</Text>
              {checklist.map((item, i) => (
                <View key={i} style={s.checkRow}>
                  <Text style={item.checked ? s.checkMarkDone : s.checkMarkPending}>
                    {item.checked ? 'Done' : 'Not done'}
                  </Text>
                  <Text style={s.checkLabel}>{item.item}</Text>
                </View>
              ))}
            </View>
            <View style={s.jobCol}>
              <Text style={s.sectionLabel}>JOB DESCRIPTION</Text>
              <Text style={s.jobText}>{jobDescription || '—'}</Text>
              <Text style={s.sectionLabel}>JOB RENDERED</Text>
              <Text style={s.jobText}>{jobRendered || '—'}</Text>
              <Text style={s.sectionLabel}>REMARKS</Text>
              <Text style={s.jobText}>{remarks || '—'}</Text>
            </View>
          </View>
        </View>

        {/* Bottom: attended-by/times | totals + payment status */}
        <View style={s.sectionBox}>
          <View style={s.bottomRow}>
            <View style={s.bottomLeft}>
              <Text style={s.sectionLabel}>ATTENDED BY</Text>
              <Text style={s.bottomLine}>{attendedBy || '—'}</Text>
              <Text style={s.sectionLabel}>TIME ARRIVED</Text>
              <Text style={s.bottomLine}>{timeArrived || '—'}</Text>
              <Text style={s.sectionLabel}>TIME COMPLETED</Text>
              <Text>{timeCompleted || '—'}</Text>
            </View>
            <View style={s.bottomRight}>
              {additionalCharges.length > 0 && (
                <View style={{ marginBottom: 8 }}>
                  <Text style={s.sectionLabel}>ADDITIONAL CHARGES</Text>
                  <Text style={s.chargeRow}>
                    <Text>Base price</Text>
                    <Text>S${basePriceSgd.toFixed(2)}</Text>
                  </Text>
                  {additionalCharges.map((c, i) => (
                    <Text key={i} style={s.chargeRow}>
                      <Text>{c.description}</Text>
                      <Text>S${c.amount_sgd.toFixed(2)}</Text>
                    </Text>
                  ))}
                </View>
              )}
              <Text style={s.totalText}>Total : S${totalSgd.toFixed(2)}</Text>
              <Text style={s.paymentLabel}>PAYMENT STATUS</Text>
              {invoiceStatus === 'PAID' ? (
                <Text style={s.paymentValue}>
                  Paid{paymentMethod ? ` via ${paymentMethod}` : ''}{paidAt ? ` on ${paidAt}` : ''}
                </Text>
              ) : (
                <Text style={s.paymentValue}>Unpaid</Text>
              )}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
