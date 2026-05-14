// EMVCo SGQR / PayNow QR payload builder for Singapore PayNow mobile transfers

function tlv(tag: string, value: string): string {
  const len = String(value.length).padStart(2, '0')
  return `${tag}${len}${value}`
}

function crc16ccitt(data: string): string {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc <<= 1
      }
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function normaliseMobile(mobile: string): string {
  // Ensure format is +65XXXXXXXX
  const digits = mobile.replace(/\D/g, '')
  if (digits.startsWith('65') && digits.length === 10) return `+${digits}`
  if (digits.length === 8) return `+65${digits}`
  return mobile.startsWith('+') ? mobile : `+${mobile}`
}

export function buildPayNowPayload(mobile: string, amountSgd: number, ref: string): string {
  const proxyValue = normaliseMobile(mobile)

  // Tag 26: Merchant Account — SG.PAYNOW
  const merchantAccount = tlv('00', 'SG.PAYNOW') + tlv('01', '2') + tlv('02', proxyValue) + tlv('03', '0')

  const body =
    tlv('00', '01') +        // Payload format indicator
    tlv('01', '12') +        // Point of initiation: static
    tlv('26', merchantAccount) +
    tlv('52', '0000') +      // Merchant category code (unspecified)
    tlv('53', '702') +       // Currency: SGD
    tlv('54', amountSgd.toFixed(2)) +
    tlv('58', 'SG') +        // Country
    tlv('59', 'HydroWash') + // Merchant name
    tlv('60', 'Singapore') + // City
    tlv('62', tlv('05', ref.slice(0, 25))) + // Additional data: reference
    '6304'                   // CRC placeholder tag (value appended after)

  return body + crc16ccitt(body)
}
