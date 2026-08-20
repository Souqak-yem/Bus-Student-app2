import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const DEFAULT_META = {
  siteName: 'تنسيقية مواصلات فلك',
  title: 'تنسيقية مواصلات فلك | نظام إدارة نقل الطلاب',
  description: 'نظام إدارة نقل الطلاب والرحلات الجامعية باعتمادية ووضوح.',
  image: '/og-image.png',
  imageAlt: 'شعار تنسيقية مواصلات فلك',
  locale: 'ar_AR',
  themeColor: '#F97316',
  twitterCard: 'summary_large_image',
}

function upsertMeta(attribute, value, content) {
  if (!content) return
  let element = document.head.querySelector(`meta[${attribute}="${value}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, value)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

function upsertLink(rel, href) {
  let element = document.head.querySelector(`link[rel="${rel}"]`)
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', rel)
    document.head.appendChild(element)
  }
  element.setAttribute('href', href)
}

function applyMeta(rawMeta) {
  const meta = { ...DEFAULT_META, ...(rawMeta || {}) }
  const origin = window.location.origin
  const imageUrl = new URL(meta.image, origin).href
  const canonicalUrl = `${origin}${window.location.pathname}${window.location.search}`

  document.title = meta.title
  upsertMeta('name', 'description', meta.description)
  upsertMeta('name', 'theme-color', meta.themeColor)
  upsertMeta('property', 'og:type', 'website')
  upsertMeta('property', 'og:site_name', meta.siteName)
  upsertMeta('property', 'og:title', meta.title)
  upsertMeta('property', 'og:description', meta.description)
  upsertMeta('property', 'og:image', imageUrl)
  upsertMeta('property', 'og:image:url', imageUrl)
  upsertMeta('property', 'og:image:secure_url', imageUrl)
  upsertMeta('property', 'og:image:type', 'image/png')
  upsertMeta('property', 'og:image:width', '1200')
  upsertMeta('property', 'og:image:height', '630')
  upsertMeta('property', 'og:image:alt', meta.imageAlt)
  upsertMeta('property', 'og:url', canonicalUrl)
  upsertMeta('property', 'og:locale', meta.locale)
  upsertMeta('name', 'twitter:card', meta.twitterCard)
  upsertMeta('name', 'twitter:title', meta.title)
  upsertMeta('name', 'twitter:description', meta.description)
  upsertMeta('name', 'twitter:image', imageUrl)
  upsertMeta('name', 'twitter:image:alt', meta.imageAlt)
  upsertLink('canonical', canonicalUrl)
}

export default function DynamicMetaTags() {
  const location = useLocation()

  useEffect(() => {
    let active = true

    fetch('/site-meta.json', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : {})
      .catch(() => ({}))
      .then((meta) => {
        if (active) applyMeta(meta)
      })

    return () => {
      active = false
    }
  }, [location.pathname, location.search])

  return null
}
