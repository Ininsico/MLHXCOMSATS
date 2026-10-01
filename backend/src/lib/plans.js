const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    tagline: 'Everything you need to go live',
    themes: ['classic'],
    features: [
      'Public hospital listing',
      'Appointments and patient requests',
      'Staff directory',
      'Inventory and laboratory modules',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 4900,
    tagline: 'For clinics with a busy front desk',
    themes: ['classic', 'emerald', 'sunrise'],
    features: [
      'Everything in Starter',
      'Emerald and Sunrise page themes',
      'Verification badge priority review',
      'AI booking assistant on your listing',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 14900,
    tagline: 'Multi-department hospitals',
    themes: ['classic', 'emerald', 'sunrise', 'midnight'],
    features: [
      'Everything in Growth',
      'Midnight theme for 24/7 departments',
      'Unlimited staff and laboratory catalogues',
      'Priority support window',
    ],
  },
]

const THEMES = [
  {
    id: 'classic',
    name: 'Classic white',
    description: 'Calm white canvas with green accents — the default Aurora look.',
    planId: 'starter',
  },
  {
    id: 'emerald',
    name: 'Emerald banner',
    description: 'A deep forest banner behind your hospital name, white cards below.',
    planId: 'growth',
  },
  {
    id: 'sunrise',
    name: 'Sunrise tint',
    description: 'Warm tinted hero and softer cards for a friendlier first impression.',
    planId: 'growth',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Dark canvas with light cards — built for departments open around the clock.',
    planId: 'enterprise',
  },
]

function findPlan(planId) {
  return PLANS.find((plan) => plan.id === planId) ?? null
}

function findTheme(themeId) {
  return THEMES.find((theme) => theme.id === themeId) ?? null
}

function themesForPlan(planId) {
  const plan = findPlan(planId)
  return plan ? plan.themes : []
}

module.exports = { PLANS, THEMES, findPlan, findTheme, themesForPlan }
