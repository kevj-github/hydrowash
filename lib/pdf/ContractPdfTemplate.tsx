import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export interface ContractPdfProps {
  customerName: string
  contactNo: string
  address: string
  numUnits: number
  unitType: string
  totalAmountSgd: number
  serviceDueMonths: string[]   // ['Jul 2026', 'Oct 2026', 'Jan 2027', 'Apr 2027']
  issuedDate: string           // '20/05/2026'
  company: {
    address: string
    phone: string
    email: string
    instagram: string
    officerName: string
  }
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, padding: 40, color: '#1e293b' },
  logoBox: { backgroundColor: '#0f172a', padding: '10 16', marginBottom: 16, alignItems: 'center' },
  logoText: { color: '#ffffff', fontSize: 20, fontFamily: 'Helvetica-Bold' },
  logoSub: { color: '#93c5fd', fontSize: 8, marginTop: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  companyText: { fontSize: 8, color: '#475569', lineHeight: 1.5 },
  infoRow: { flexDirection: 'row', marginBottom: 4 },
  infoLabel: { width: 70, color: '#64748b' },
  infoValue: { flex: 1 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 12 },
  heading: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  body: { lineHeight: 1.6 },
  italic: { fontFamily: 'Helvetica-Oblique', fontSize: 8, color: '#475569', marginTop: 4 },
  table: { marginVertical: 10 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#0f172a', padding: '5 8' },
  tableHeaderCell: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 8 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', padding: '5 8' },
  col1: { width: '15%' },
  col2: { width: '30%' },
  col3: { width: '25%' },
  col4: { width: '30%' },
  sectionTitle: { fontFamily: 'Helvetica-Bold', textDecoration: 'underline', marginBottom: 6, marginTop: 10 },
  bulletRow: { flexDirection: 'row', marginBottom: 3 },
  bullet: { width: 12, color: '#0369a1' },
  bulletText: { flex: 1, lineHeight: 1.5 },
  twoCol: { flexDirection: 'row', gap: 16 },
  half: { flex: 1 },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 32 },
  signBlock: { width: '45%' },
  signLine: { borderBottomWidth: 1, borderBottomColor: '#1e293b', marginBottom: 4 },
  signLabel: { fontSize: 8, color: '#64748b' },
})

const SCOPE_ITEMS_LEFT = [
  'Prior to removal of A/C covers:',
  '  - Visual inspection of A/C component',
  '  - Check fan motor / louver motor for abnormalities',
  '  - Testing A/C operation under normal condition',
  '  - Check control sequence and functionality of remote control',
  '',
  'Upon completion of preliminary checks:',
  '  - Clean / brush indoor unit cover & evaporator filter',
  '  - Hydro-washing and brushing evaporator coil & Louver',
  '  - Removal and cleaning of condensation tray every 6 months',
]

const SCOPE_ITEMS_RIGHT = [
  'Upon completion of cleaning:',
  '  - Check & properly tighten the A/C cover',
  '  - Re-check the unit for vibration',
  '  - Visual inspection of A/C component',
  '  - Re-check fan motor / louver motor for abnormalities',
  '  - Testing A/C operation under normal condition',
  '',
  'Applying steam cleaning (upon recommendation)',
]

const EXCLUSIONS = ['Chemical cleaning', 'Gas top up', 'Air condition replacement parts']

export function ContractPdfTemplate({
  customerName, contactNo, address, numUnits, unitType,
  totalAmountSgd, serviceDueMonths, issuedDate, company,
}: ContractPdfProps) {
  return (
    <Document>
      {/* PAGE 1 */}
      <Page size="A4" style={s.page}>
        {/* Logo */}
        <View style={s.logoBox}>
          <Text style={s.logoText}>HydroWash</Text>
          <Text style={s.logoSub}>Aircon Service</Text>
        </View>

        {/* Company address */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.companyText}>{company.address}</Text>
            <Text style={s.companyText}>Tel : {company.phone}</Text>
            <Text style={s.companyText}>Email : {company.email}</Text>
          </View>
        </View>

        {/* Customer info */}
        <View style={s.infoRow}><Text style={s.infoLabel}>Name</Text><Text style={s.infoValue}>: {customerName}</Text></View>
        <View style={s.infoRow}><Text style={s.infoLabel}>Contact No</Text><Text style={s.infoValue}>: {contactNo}</Text></View>
        <View style={s.infoRow}><Text style={s.infoLabel}>Address</Text><Text style={s.infoValue}>: {address}</Text></View>

        <View style={s.divider} />

        {/* Subject */}
        <Text style={{ marginBottom: 8, fontSize: 10 }}>Re: Annual Hydrowash Air Conditioning Cleaning Contract</Text>
        <Text style={{ marginBottom: 6 }}>Dear Customer,</Text>
        <Text style={[s.body, { marginBottom: 4 }]}>
          Thank you for choosing Hydrowash. The following agreement spells out the terms and conditions of this contract. Please find the below price for General Service for the period of one year.
        </Text>
        <Text style={s.italic}>*(Contract is non-transferable. No extension for contract duration and or refund for unused services)</Text>

        {/* Pricing table */}
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, s.col1]}>SERVICES{'\n'}PER YEAR</Text>
            <Text style={[s.tableHeaderCell, s.col2]}>UNITS (INDOOR)</Text>
            <Text style={[s.tableHeaderCell, s.col3]}>TOTAL AMOUNT (SGD)</Text>
            <Text style={[s.tableHeaderCell, s.col4]}>SCHEDULE</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={s.col1}>4</Text>
            <Text style={s.col2}>{numUnits}x {unitType}</Text>
            <Text style={s.col3}>S$ {totalAmountSgd.toFixed(2)}</Text>
            <View style={s.col4}>
              {serviceDueMonths.map((m, i) => (
                <Text key={i}>{m}</Text>
              ))}
            </View>
          </View>
        </View>

        <Text style={s.italic}>*(PK also known as HP(Horsepower) refers to power of aircon unit which is directly translated to size)</Text>
        <Text style={[s.italic, { marginTop: 2 }]}>*Please adhere to the given schedule (particular month duration) as there is no replacement for missed air-con servicing.</Text>

        {/* Scope of Work */}
        <Text style={s.sectionTitle}>Scope of Work for general indoor unit cleaning on</Text>
        <View style={s.twoCol}>
          <View style={s.half}>
            {SCOPE_ITEMS_LEFT.map((item, i) => (
              <Text key={i} style={{ fontSize: 8, lineHeight: 1.5, marginBottom: 1 }}>{item}</Text>
            ))}
          </View>
          <View style={s.half}>
            {SCOPE_ITEMS_RIGHT.map((item, i) => (
              <Text key={i} style={{ fontSize: 8, lineHeight: 1.5, marginBottom: 1 }}>{item}</Text>
            ))}
          </View>
        </View>
      </Page>

      {/* PAGE 2 */}
      <Page size="A4" style={s.page}>
        <View style={s.logoBox}>
          <Text style={s.logoText}>HydroWash</Text>
          <Text style={s.logoSub}>Aircon Service</Text>
        </View>

        {/* Exclusions */}
        <Text style={s.sectionTitle}>Exclude:</Text>
        {EXCLUSIONS.map((item, i) => (
          <View key={i} style={s.bulletRow}>
            <Text style={s.bullet}>❖</Text>
            <Text style={s.bulletText}>{item}</Text>
          </View>
        ))}

        <View style={s.divider} />

        <Text style={[s.body, { marginBottom: 6 }]}>
          Payment of fee must be as follows: Full payment for one year upon signing by cash, bank transfer or Paynow. No cancellation or refund is allowed, once payment is made.
        </Text>
        <Text style={[s.body, { marginBottom: 6 }]}>
          The above contract described the general cleaning procedure for every maintenance job for your information.
        </Text>
        <Text style={[s.body, { marginBottom: 6 }]}>
          Any other items not mentioned shall be quoted separately and may incur additional charges.
        </Text>
        <Text style={{ marginBottom: 4 }}>Please do not hesitate to contact us if you need any further information.</Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>{company.officerName}: {company.phone}</Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 16 }}>Follow us at our Instagram: {company.instagram}</Text>

        <Text style={{ marginBottom: 20 }}>Date: {issuedDate}</Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 24 }}>ACCEPTED AND AGREED BY:</Text>

        {/* Signature block */}
        <View style={s.signRow}>
          <View style={s.signBlock}>
            <View style={[s.signLine, { marginBottom: 4 }]} />
            <Text style={s.signLabel}>Signature and name</Text>
          </View>
          <View style={s.signBlock}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>{company.officerName}</Text>
            <View style={s.signLine} />
            <Text style={s.signLabel}>Authorised Issuing Officer</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
