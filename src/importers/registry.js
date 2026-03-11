import { detectGPay, parseGPay } from './gpay'

const UPI_APPS = [
  {
    id: 'gpay',
    name: 'Google Pay',
    detect: detectGPay,
    parse: parseGPay,
  },
  // Future: { id: 'phonepe', name: 'PhonePe', detect: detectPhonePe, parse: parsePhonePe },
  // Future: { id: 'paytm',   name: 'Paytm',    detect: detectPaytm,   parse: parsePaytm },
]

export function getRegisteredApps() {
  return UPI_APPS.map(({ id, name }) => ({ id, name }))
}

export function detectUPIApp(pages) {
  for (const app of UPI_APPS) {
    if (app.detect(pages)) return app
  }
  return null
}

export function getAppById(appId) {
  return UPI_APPS.find(a => a.id === appId) || null
}
