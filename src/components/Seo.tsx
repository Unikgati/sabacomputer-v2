import React, { useEffect } from 'react';

interface SeoProps {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  siteName?: string;
  twitterHandle?: string;
  jsonLd?: object | null;
}

function upsertMeta(name: string, value: string, attr: 'name' | 'property' = 'name') {
  try {
    const selector = attr === 'property' ? `meta[property="${name}"]` : `meta[name="${name}"]`;
    let el = document.head.querySelector(selector) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      if (attr === 'property') el.setAttribute('property', name);
      else el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  } catch (e) {}
}

const Seo: React.FC<SeoProps> = ({ title, description, url, image, siteName, twitterHandle = '', jsonLd = null }) => {
  // If siteName not provided, try to read from localStorage.appSettings (set by App on load).
  let effectiveSiteName = 'TravelGo';
  try {
    if (siteName && siteName.trim()) effectiveSiteName = siteName;
    else {
      const stored = localStorage.getItem('appSettings');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.brandName) effectiveSiteName = parsed.brandName;
        } catch (e) {}
      }
    }
  } catch (e) {
    // ignore localStorage errors
  }
  useEffect(() => {
    try {
      if (title) document.title = title;
      if (description) upsertMeta('description', description);
  if (effectiveSiteName) upsertMeta('og:site_name', effectiveSiteName, 'property');
      if (title) upsertMeta('og:title', title, 'property');
      if (description) upsertMeta('og:description', description, 'property');
      if (url) upsertMeta('og:url', url, 'property');
      if (image) upsertMeta('og:image', image, 'property');
      upsertMeta('twitter:card', image ? 'summary_large_image' : 'summary');
      if (twitterHandle) upsertMeta('twitter:site', twitterHandle);
      if (title) upsertMeta('twitter:title', title);
      if (description) upsertMeta('twitter:description', description);
      if (image) upsertMeta('twitter:image', image);

      // canonical link
      if (url) {
        let link = document.head.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement('link');
          link.setAttribute('rel', 'canonical');
          document.head.appendChild(link);
        }
        link.setAttribute('href', url);
      }

      // JSON-LD
      if (jsonLd) {
        let ld = document.getElementById('json-ld-script') as HTMLScriptElement | null;
        if (!ld) {
          ld = document.createElement('script');
          ld.id = 'json-ld-script';
          ld.type = 'application/ld+json';
          document.head.appendChild(ld);
        }
        ld.textContent = JSON.stringify(jsonLd);
      }
    } catch (e) {
      // no-op
    }
  }, [title, description, url, image, siteName, twitterHandle, jsonLd]);

  return null;
};

export default Seo;
