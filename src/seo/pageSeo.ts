export interface PageSeo {
  title: string
  description: string
  keywords: string
  path: string
  ogType?: 'website' | 'article'
}

export const SITE_NAME = 'Finance Tracker'
export const SITE_TAGLINE = 'Personal Money Manager for Indian Households'
export const SITE_LOCALE = 'en_IN'

/** Set VITE_SITE_URL in production to your live domain, e.g. https://yourdomain.com */
export const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '')
  || 'https://finance-tracker.app'

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.svg`

export const PAGE_SEO: Record<string, PageSeo> = {
  dashboard: {
    title: 'Monthly Finance Dashboard — Budget Overview & Savings Tracker',
    description:
      'Track monthly income, fixed bills, daily expenses, and savings with visual charts. Free personal finance dashboard for Indian households — works offline in your browser.',
    keywords:
      'monthly finance dashboard, budget tracker India, household expense tracker, savings calculator, personal finance dashboard, money manager app',
    path: '/',
    ogType: 'website',
  },
  annual: {
    title: 'Annual Finance Dashboard — Yearly Income, Expenses & Savings Analysis',
    description:
      'Analyze your full financial year (Apr–Mar) with income vs expense trends, savings rate, category breakdown, and monthly tables. Indian FY budget reporting made simple.',
    keywords:
      'annual finance report, financial year tracker India, yearly budget analysis, savings rate calculator, FY expense report, annual income tracker',
    path: '/annual-dashboard',
    ogType: 'website',
  },
  members: {
    title: 'Income Tracker — Manage Household Salary & Monthly Earnings',
    description:
      'Add and track income members, monthly salaries, and total household earnings. Organize family income in one place alongside your expense tracker.',
    keywords:
      'income tracker, salary tracker India, household income manager, monthly earnings tracker, family income budget, salary management app',
    path: '/income',
    ogType: 'website',
  },
  fixed: {
    title: 'Fixed Expenses Tracker — Rent, EMI, Bills & Recurring Payments',
    description:
      'Manage recurring fixed expenses like rent, EMIs, insurance, and subscriptions. Track due dates, paid status, and sub-item breakdowns every month.',
    keywords:
      'fixed expense tracker, rent tracker, EMI tracker India, recurring bills manager, monthly bills tracker, subscription expense tracker',
    path: '/fixed',
    ogType: 'website',
  },
  daily: {
    title: 'Daily Expense Tracker — Log Spending by Category & Payment Method',
    description:
      'Record day-to-day spending with categories, UPI/card/cash payments, and bank tags. Import bank statements and visualize daily spending habits.',
    keywords:
      'daily expense tracker, spending tracker India, UPI expense tracker, category wise expenses, personal expense log, daily budget tracker',
    path: '/daily',
    ogType: 'website',
  },
  investments: {
    title: 'Investment Tracker — Monthly SIP, Stocks & Mutual Fund Allocations',
    description:
      'Track monthly investments in mutual funds, stocks, FD, PPF, and more separately from expenses. See gross savings, invested amount, and cash remaining.',
    keywords:
      'investment tracker India, SIP tracker, mutual fund tracker, stock investment log, monthly investment planner, savings allocation app',
    path: '/investments',
    ogType: 'website',
  },
  privacy: {
    title: 'Privacy Policy — How Finance Tracker Protects Your Data',
    description:
      'Learn how Finance Tracker stores your financial data locally or in encrypted Google Cloud Firestore. No ads, no analytics, no third-party data sharing.',
    keywords:
      'finance tracker privacy policy, personal finance data security, local storage budget app, Firestore privacy, no tracking expense app',
    path: '/privacy',
    ogType: 'article',
  },
  about: {
    title: 'About Finance Tracker — Free Personal Finance App for India',
    description:
      'Finance Tracker helps Indian households manage income, fixed bills, and daily expenses month by month. Free browser app with charts, import/export, and optional cloud sync.',
    keywords:
      'about finance tracker, free expense tracker India, personal money manager, household budget app, made in India finance app',
    path: '/about',
    ogType: 'website',
  },
}

export function getPageSeo(pageKey: string): PageSeo {
  return PAGE_SEO[pageKey] ?? PAGE_SEO.dashboard
}

export function getCanonicalUrl(path: string): string {
  return `${SITE_URL}${path === '/' ? '' : path}`
}

export function buildWebAppJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    description: PAGE_SEO.about.description,
    url: SITE_URL,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
    },
    featureList: [
      'Monthly budget dashboard',
      'Annual financial year analysis',
      'Income and salary tracking',
      'Fixed expense management',
      'Daily expense logging by category',
      'Monthly investment tracking',
      'CSV, Excel, and JSON export',
      'Optional Google cloud sync',
    ],
    inLanguage: 'en-IN',
    audience: {
      '@type': 'Audience',
      geographicArea: {
        '@type': 'Country',
        name: 'India',
      },
    },
  }
}

export function buildBreadcrumbJsonLd(pageKey: string) {
  const seo = getPageSeo(pageKey)
  const items = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
  ]

  if (pageKey !== 'dashboard') {
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: seo.title.split(' — ')[0],
      item: getCanonicalUrl(seo.path),
    })
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
}

/** Maps URL pathname to SEO / tab page key */
export const PATH_TO_PAGE: Record<string, string> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/annual-dashboard': 'annual',
  '/income': 'members',
  '/fixed': 'fixed',
  '/daily': 'daily',
  '/investments': 'investments',
  '/privacy': 'privacy',
  '/about': 'about',
}

export const PAGE_TO_PATH: Record<string, string> = {
  dashboard: '/',
  annual: '/annual-dashboard',
  members: '/income',
  fixed: '/fixed',
  daily: '/daily',
  investments: '/investments',
  privacy: '/privacy',
  about: '/about',
}

export function pathToPageKey(pathname: string): string {
  return PATH_TO_PAGE[pathname] ?? 'dashboard'
}
