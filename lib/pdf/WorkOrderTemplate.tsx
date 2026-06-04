import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AcUnitDetail, ChecklistItem, AdditionalCharge } from '@/lib/types'

export interface WorkOrderProps {
  workOrderNo: number
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
  company: { address: string; phone: string; email: string }
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 8, padding: 30, color: '#1e293b' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'flex-start' },
  logoBox: { backgroundColor: '#0f172a', padding: '6 10', width: 110 },
  logoText: { color: '#ffffff', fontSize: 12, fontFamily: 'Helvetica-Bold' },
  logoSub: { color: '#93c5fd', fontSize: 6 },
  companyBlock: { flex: 1, paddingLeft: 12, lineHeight: 1.6 },
  companyText: { color: '#475569', fontSize: 7 },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 12, textAlign: 'right' },
  workOrderNo: { fontSize: 9, textAlign: 'right', color: '#0369a1', fontFamily: 'Helvetica-Bold' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 6 },
  // Info grid
  infoTable: { borderWidth: 1, borderColor: '#1e293b', marginBottom: 6 },
  infoRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  infoCell: { padding: '3 5', flex: 1, borderRightWidth: 1, borderRightColor: '#1e293b' },
  infoCellLast: { padding: '3 5', flex: 1 },
  infoLabel: { fontFamily: 'Helvetica-Bold' },
  infoRowLast: { flexDirection: 'row' },
  // AC table
  acHeader: { flexDirection: 'row', backgroundColor: '#0f172a', padding: '3 5' },
  acHeaderCell: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 7 },
  acRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', padding: '3 5' },
  acNo: { width: '6%' },
  acBrand: { width: '18%' },
  acModel: { width: '22%' },
  acSerial: { width: '24%' },
  acLocation: { width: '30%' },
  // Checklist + job desc
  twoCol: { flexDirection: 'row', gap: 10, marginTop: 6 },
  checkCol: { width: '35%' },
  jobCol: { flex: 1 },
  checkRow: { flexDirection: 'row', marginBottom: 2 },
  checkMark: { width: 12, fontFamily: 'Helvetica-Bold', color: '#0369a1' },
  checkLabel: { flex: 1 },
  sectionLabel: { fontFamily: 'Helvetica-Bold', marginBottom: 3, textDecoration: 'underline' },
  jobText: { lineHeight: 1.5, marginBottom: 6 },
  // Bottom row
  bottomRow: { flexDirection: 'row', marginTop: 10, gap: 10 },
  bottomLeft: { width: '35%' },
  bottomMid: { flex: 1 },
  bottomRight: { width: '35%', borderWidth: 1, borderColor: '#1e293b', padding: 5 },
  totalText: { fontFamily: 'Helvetica-Bold', fontSize: 14, marginBottom: 4 },
  paymentLabel: { fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  signLine: { borderBottomWidth: 1, borderBottomColor: '#1e293b', marginTop: 20, marginBottom: 3 },
  signLabel: { fontSize: 7, color: '#64748b' },
})

export function WorkOrderTemplate({
  workOrderNo, customerName, customerNo, contactNo, address,
  date, serviceType, visitNo, totalVisits,
  acDetails, checklist, jobDescription, jobRendered, remarks,
  attendedBy, timeArrived, timeCompleted,
  additionalCharges, basePriceSgd, totalSgd, company,
}: WorkOrderProps) {
  const serviceLabel = visitNo && totalVisits
    ? `${serviceType}`
    : serviceType
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
            <Text style={s.companyText}>Tell : {company.phone}</Text>
            <Text style={s.companyText}>Email : {company.email}</Text>
          </View>
          <View>
            <Text style={s.title}>Work Order Report</Text>
            <Text style={s.workOrderNo}>Work Order No : {workOrderNo}</Text>
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
              <Text><Text style={s.infoLabel}>Type of service : </Text>{serviceLabel}</Text>
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
            <View style={{ padding: '3 5' }}>
              <Text><Text style={s.infoLabel}>Address : </Text>{address}</Text>
            </View>
          </View>
        </View>

        {/* AC System Details */}
        <View style={{ borderWidth: 1, borderColor: '#1e293b', marginBottom: 6 }}>
          <View style={s.acHeader}>
            <Text style={[s.acHeaderCell, { width: '100%', textAlign: 'center' }]}>Air-Conditioning System Details</Text>
          </View>
          <View style={s.acHeader}>
            <Text style={[s.acHeaderCell, s.acNo]}>No</Text>
            <Text style={[s.acHeaderCell, s.acBrand]}>Brand</Text>
            <Text style={[s.acHeaderCell, s.acModel]}>Model</Text>
            <Text style={[s.acHeaderCell, s.acSerial]}>Serial No</Text>
            <Text style={[s.acHeaderCell, s.acLocation]}>Location</Text>
          </View>
          {[...Array(Math.max(acDetails.length, 5))].map((_, i) => {
            const unit = acDetails[i]
            return (
              <View key={i} style={s.acRow}>
                <Text style={s.acNo}>{i + 1}</Text>
                <Text style={s.acBrand}>{unit?.brand ?? ''}</Text>
                <Text style={s.acModel}>{unit?.model ?? ''}</Text>
                <Text style={s.acSerial}>{unit?.serial_no ?? ''}</Text>
                <Text style={s.acLocation}>{unit?.location ?? ''}</Text>
              </View>
            )
          })}
        </View>

        {/* Checklist + Job Description */}
        <View style={s.twoCol}>
          <View style={s.checkCol}>
            <Text style={s.sectionLabel}>Check List :</Text>
            {checklist.map((item, i) => (
              <View key={i} style={s.checkRow}>
                <Text style={s.checkMark}>{item.checked ? '√' : '-'}</Text>
                <Text style={s.checkLabel}>{item.item}</Text>
              </View>
            ))}
          </View>
          <View style={s.jobCol}>
            <Text style={s.sectionLabel}>Job Description :</Text>
            <Text style={s.jobText}>{jobDescription || '—'}</Text>
            <Text style={s.sectionLabel}>Job Rendered :</Text>
            <Text style={s.jobText}>{jobRendered || '—'}</Text>
            <Text style={s.sectionLabel}>Remarks :</Text>
            <Text style={s.jobText}>{remarks || '—'}</Text>
          </View>
        </View>

        {/* Attended by */}
        <Text style={{ marginTop: 4 }}><Text style={{ fontFamily: 'Helvetica-Bold' }}>Attended by :</Text></Text>
        <Text style={{ marginLeft: 10, marginBottom: 4 }}>1  {attendedBy}</Text>

        {/* Additional charges */}
        {additionalCharges.length > 0 && (
          <View style={{ marginTop: 4 }}>
            <Text style={s.sectionLabel}>Additional Charges :</Text>
            {additionalCharges.map((c, i) => (
              <Text key={i} style={{ marginLeft: 10 }}>{c.description}: S${c.amount_sgd.toFixed(2)}</Text>
            ))}
          </View>
        )}

        {/* Bottom row */}
        <View style={s.bottomRow}>
          <View style={s.bottomLeft}>
            <Text style={{ marginBottom: 4 }}><Text style={{ fontFamily: 'Helvetica-Bold' }}>Time Arrived : </Text>{timeArrived}</Text>
            <Text><Text style={{ fontFamily: 'Helvetica-Bold' }}>Time Completed : </Text>{timeCompleted}</Text>
          </View>
          <View style={s.bottomMid}>
            <Text style={s.totalText}>Sub Total : S${totalSgd.toFixed(2)}</Text>
            <Text style={s.paymentLabel}>Payment Types</Text>
            <Text>PayNow</Text>
          </View>
          <View style={s.bottomRight}>
            <Text style={{ fontSize: 7, lineHeight: 1.5 }}>I Confirm that the above works had been carried out to my satisfaction</Text>
            <Text style={[s.sectionLabel, { marginTop: 6 }]}>Remarks:</Text>
            <View style={s.signLine} />
            <Text style={s.signLabel}>Signature / Name / Date</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
