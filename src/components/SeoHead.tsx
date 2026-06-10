import { Helmet } from 'react-helmet-async'
import {
  SITE_NAME,
  SITE_TAGLINE,
  SITE_LOCALE,
  DEFAULT_OG_IMAGE,
  getPageSeo,
  getCanonicalUrl,
  buildWebAppJsonLd,
  buildBreadcrumbJsonLd,
} from '../seo/pageSeo'

interface SeoHeadProps {
  pageKey: string
}

export default function SeoHead({ pageKey }: SeoHeadProps) {
  const seo = getPageSeo(pageKey)
  const canonical = getCanonicalUrl(seo.path)
  const title = `${seo.title} | ${SITE_NAME}`

  return (
    <Helmet prioritizeSeoTags>
      <html lang="en-IN" />
      <title>{title}</title>
      <meta name="description" content={seo.description} />
      <meta name="keywords" content={seo.keywords} />
      <meta name="author" content={SITE_NAME} />
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      <link rel="canonical" href={canonical} />

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={seo.ogType ?? 'website'} />
      <meta property="og:locale" content={SITE_LOCALE} />
      <meta property="og:image" content={DEFAULT_OG_IMAGE} />
      <meta property="og:image:alt" content={`${SITE_NAME} — ${SITE_TAGLINE}`} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />

      {/* Structured data */}
      <script type="application/ld+json">{JSON.stringify(buildWebAppJsonLd())}</script>
      <script type="application/ld+json">{JSON.stringify(buildBreadcrumbJsonLd(pageKey))}</script>
    </Helmet>
  )
}
