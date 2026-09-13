export type PaymentOperatingMode = 'partner_psp' | 'sandbox_direct'

export function getPaymentOperatingMode(): PaymentOperatingMode {
  const mode = process.env.MOBIPAY_OPERATING_MODE || 'sandbox_direct'
  return mode === 'partner_psp' ? 'partner_psp' : 'sandbox_direct'
}

export function assertProductionPaymentBoundary(environment: string | undefined): void {
  if (environment !== 'production') return

  if (getPaymentOperatingMode() !== 'partner_psp') {
    throw new Error('Production payment initiation is disabled until MobiPay is configured to operate under an approved licensed PSP arrangement.')
  }

  if (process.env.PSP_LICENSE_STATUS !== 'verified') {
    throw new Error('Production payment initiation is disabled until the licensed PSP arrangement is verified.')
  }

  if (!process.env.PSP_PROVIDER_ID) {
    throw new Error('Production payment initiation is disabled because PSP_PROVIDER_ID is not configured.')
  }
}

export function paymentBoundaryStatus() {
  const mode = getPaymentOperatingMode()
  const productionApproved = mode === 'partner_psp' && process.env.PSP_LICENSE_STATUS === 'verified' && Boolean(process.env.PSP_PROVIDER_ID)
  return {
    mode,
    pspConfigured: Boolean(process.env.PSP_PROVIDER_ID),
    pspLicenseStatus: process.env.PSP_LICENSE_STATUS || 'unverified',
    productionPaymentEnabled: productionApproved,
  }
}
