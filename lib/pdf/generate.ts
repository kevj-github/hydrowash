import { renderToBuffer } from '@react-pdf/renderer'
import type { ContractPdfProps } from './ContractPdfTemplate'
import type { WorkOrderProps } from './WorkOrderTemplate'

export async function generateContractPdf(props: ContractPdfProps): Promise<Buffer> {
  const { ContractPdfTemplate } = await import('./ContractPdfTemplate')
  const element = ContractPdfTemplate(props)
  const buf = await renderToBuffer(element)
  return Buffer.from(buf)
}

export async function generateWorkOrderPdf(props: WorkOrderProps): Promise<Buffer> {
  const { WorkOrderTemplate } = await import('./WorkOrderTemplate')
  const element = WorkOrderTemplate(props)
  const buf = await renderToBuffer(element)
  return Buffer.from(buf)
}
