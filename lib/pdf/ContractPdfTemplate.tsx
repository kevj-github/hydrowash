import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export interface ContractPdfProps {
  customerName: string
  contactNo: string
  address: string
  numUnits: number
  unitType: string
  unitSummary?: string
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
  page: { fontFamily: 'Helvetica', fontSize: 8.5, padding: 28, color: '#1e293b' },
  logoBox: { backgroundColor: '#0f172a', padding: '7 14', marginBottom: 10, alignItems: 'center' },
  logoText: { color: '#ffffff', fontSize: 16, fontFamily: 'Helvetica-Bold' },
  logoSub: { color: '#93c5fd', fontSize: 7, marginTop: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  companyText: { fontSize: 7.5, color: '#475569', lineHeight: 1.3 },
  infoRow: { flexDirection: 'row', marginBottom: 2 },
  infoLabel: { width: 65, color: '#64748b' },
  infoValue: { flex: 1 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 6 },
  body: { lineHeight: 1.35 },
  italic: { fontFamily: 'Helvetica-Oblique', fontSize: 7.5, color: '#475569', marginTop: 2 },
  table: { marginVertical: 6 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#0f172a', padding: '4 8' },
  tableHeaderCell: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', padding: '4 8' },
  col1: { width: '15%' },
  col2: { width: '30%' },
  col3: { width: '25%' },
  col4: { width: '30%' },
  sectionTitle: { fontFamily: 'Helvetica-Bold', textDecoration: 'underline', marginBottom: 4, marginTop: 6 },
  twoCol: { flexDirection: 'row', gap: 16 },
  half: { flex: 1 },
  scopeItem: { fontSize: 7.5, lineHeight: 1.3 },
  scopeGroupHeading: { fontSize: 7.5, lineHeight: 1.3, marginTop: 4 },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  signBlock: { width: '45%' },
  signLine: { borderBottomWidth: 1, borderBottomColor: '#1e293b', marginBottom: 3 },
  signLabel: { fontSize: 7.5, color: '#64748b' },
})

const SCOPE_ITEMS_LEFT = [
  { heading: 'Prior to removal of A/C covers:', items: [
    'Visual inspection of A/C component',
    'Check fan motor / louver motor for abnormalities',
    'Testing A/C operation under normal condition',
    'Check control sequence and functionality of remote control',
  ] },
  { heading: 'Upon completion of preliminary checks:', items: [
    'Clean / brush indoor unit cover & evaporator filter',
    'Hydro-washing and brushing evaporator coil & Louver',
    'Removal and cleaning of condensation tray every 6 months',
  ] },
]

const SCOPE_ITEMS_RIGHT = [
  { heading: 'Upon completion of cleaning:', items: [
    'Check & properly tighten the A/C cover',
    'Re-check the unit for vibration',
    'Visual inspection of A/C component',
    'Re-check fan motor / louver motor for abnormalities',
    'Testing A/C operation under normal condition',
  ] },
  { heading: 'Applying steam cleaning (upon recommendation)', items: [] },
]

const EXCLUSIONS = ['Chemical cleaning', 'Gas top up', 'Air condition replacement parts']

export function ContractPdfTemplate({
  customerName, contactNo, address, numUnits, unitType, unitSummary,
  totalAmountSgd, serviceDueMonths, issuedDate, company,
}: ContractPdfProps) {
  return (
    <Document>
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
        <Text style={{ marginBottom: 4, fontSize: 9 }}>Re: Annual Hydrowash Air Conditioning Cleaning Contract</Text>
        <Text style={{ marginBottom: 3 }}>Dear Customer,</Text>
        <Text style={[s.body, { marginBottom: 2 }]}>
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
            <Text style={s.col2}>{unitSummary ?? `${numUnits}x ${unitType}`}</Text>
            <Text style={s.col3}>S$ {totalAmountSgd.toFixed(2)}</Text>
            <View style={s.col4}>
              {serviceDueMonths.map((m, i) => (
                <Text key={i}>{m}</Text>
              ))}
            </View>
          </View>
        </View>

        <Text style={s.italic}>*(PK also known as HP(Horsepower) refers to power of aircon unit which is directly translated to size)</Text>
        <Text style={[s.italic, { marginTop: 1 }]}>*Please adhere to the given schedule (particular month duration) as there is no replacement for missed air-con servicing.</Text>

        {/* Scope of Work */}
        <Text style={s.sectionTitle}>Scope of Work for general indoor unit cleaning on</Text>
        <View style={s.twoCol}>
          <View style={s.half}>
            {SCOPE_ITEMS_LEFT.map((group, gi) => (
              <View key={gi}>
                <Text style={s.scopeGroupHeading}>{group.heading}</Text>
                {group.items.map((item, i) => (
                  <Text key={i} style={s.scopeItem}>  - {item}</Text>
                ))}
              </View>
            ))}
          </View>
          <View style={s.half}>
            {SCOPE_ITEMS_RIGHT.map((group, gi) => (
              <View key={gi}>
                <Text style={s.scopeGroupHeading}>{group.heading}</Text>
                {group.items.map((item, i) => (
                  <Text key={i} style={s.scopeItem}>  - {item}</Text>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* Exclusions */}
        <Text style={s.sectionTitle}>Exclude:</Text>
        {EXCLUSIONS.map((item, i) => (
          <Text key={i} style={s.scopeItem}>  - {item}</Text>
        ))}

        <View style={s.divider} />

        <Text style={[s.body, { marginBottom: 3 }]}>
          Payment of fee must be as follows: Full payment for one year upon signing by cash, bank transfer or Paynow. No cancellation or refund is allowed, once payment is made.
        </Text>
        <Text style={[s.body, { marginBottom: 3 }]}>
          The above contract described the general cleaning procedure for every maintenance job for your information. Any other items not mentioned shall be quoted separately and may incur additional charges.
        </Text>
        <Text style={{ marginBottom: 3 }}>Please do not hesitate to contact us if you need any further information.</Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 1 }}>{company.officerName}: {company.phone}</Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>Follow us at our Instagram: {company.instagram}</Text>

        <Text style={{ marginBottom: 8 }}>Date: {issuedDate}</Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>ACCEPTED AND AGREED BY:</Text>

        {/* Signature block */}
        <View style={s.signRow}>
          <View style={s.signBlock}>
            <View style={[s.signLine, { marginBottom: 3 }]} />
            <Text style={s.signLabel}>Signature and name</Text>
          </View>
          <View style={s.signBlock}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>{company.officerName}</Text>
            <View style={s.signLine} />
            <Text style={s.signLabel}>Authorised Issuing Officer</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
