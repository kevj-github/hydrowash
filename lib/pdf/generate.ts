import { renderToBuffer } from '@react-pdf/renderer'
import type { ContractPdfProps } from './ContractPdfTemplate'

export async function generateContractPdf(props: ContractPdfProps): Promise<Buffer> {
  const { ContractPdfTemplate } = await import('./ContractPdfTemplate')
  const element = ContractPdfTemplate(props)
  const buf = await renderToBuffer(element)
  return Buffer.from(buf)
}
