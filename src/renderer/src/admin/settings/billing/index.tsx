import ContentSection from '../components/content-section'
import { BillingForm } from './billing-form'

export default function SettingsBilling() {
  return (
    <ContentSection
      title='Billing & Subscription'
      desc='Manage your subscription, payment methods, and quota usage. Upgrade your plan when credits are finished.'
    >
      <BillingForm />
    </ContentSection>
  )
}