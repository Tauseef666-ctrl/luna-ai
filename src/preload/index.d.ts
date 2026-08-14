export type { LunaBridge } from './index'

declare global {
  interface Window {
    luna: import('./index').LunaBridge
  }
}
