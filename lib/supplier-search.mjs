import { findAlternativeQuery } from '../packages/core/catalog.mjs';
import { assertPublicSupplierUrl } from '../packages/core/url-safety.mjs';
import { publicFetch } from './public-fetch.mjs';

export function searchSettings(env = process.env) {
  const provider = ['tavily', 'brave'].includes(env.SEARCH_PROVIDER) ? env.SEARCH_PROVIDER : null;
  const requested = Number(env.SEARCH_MONTHLY_LIMIT ?? 900);
  const limit = Number.isInteger(requested) && requested >= 0 ? Math.min(900, requested) : 900;
  return { provider, configured: Boolean(provider && env.SEARCH_API_KEY), limit };
}

export async function searchSummary(repository, env = process.env, now = Date.now()) {
  const settings = searchSettings(env);
  const usage = settings.provider ? await repository.searchUsage(settings.provider, now)
    : { month: new Date(now).toISOString().slice(0, 7), used: 0 };
  return { ...settings, month: usage.month, used: usage.used,
    remaining: Math.max(0, settings.limit - usage.used) };
}

export async function searchAlternatives(product, {
  repository, env = process.env, now = Date.now(), fetchPage = publicFetch,
} = {}) {
  const { provider, configured, limit } = searchSettings(env);
  const empty = status => ({ status, urls: [] });
  if (!configured) return empty('unconfigured');
  if (!repository) throw new Error('Persistent search repository required');
  if (!await repository.reserveSearch(provider, limit, now)) return empty('budget_exhausted');
  // Reserve before the request; failed/ambiguous requests also consume a local slot.
  // No automatic retries, answers, extraction, crawl or advanced search credits.
  const query = findAlternativeQuery(product).slice(0, 300);
  let response;
  try {
    response = provider === 'tavily'
      ? await fetchPage('https://api.tavily.com/search', {
          method: 'POST', redirects: 0, maxBytes: 500000, timeout: 20000,
          headers: { Authorization: `Bearer ${env.SEARCH_API_KEY}`, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ query, topic: 'general', search_depth: 'basic',
            max_results: 5, auto_parameters: false, include_answer: false,
            include_raw_content: false, include_images: false, include_usage: true }),
        })
      : await fetchPage('https://api.search.brave.com/res/v1/web/search?' + new URLSearchParams({q:query,count:'5'}), {
          redirects: 0, maxBytes: 500000,
          headers: { 'X-Subscription-Token': env.SEARCH_API_KEY, accept: 'application/json' },
        });
    if ([401,403].includes(response.status)) return empty('invalid_key');
    if (response.status === 429) return empty('rate_limited');
    if ([402,432].includes(response.status)) return empty('quota_exhausted');
    if (response.status !== 200) return empty('unavailable');
    const data = JSON.parse(response.text);
    const rows = provider === 'tavily' ? data.results : data.web?.results;
    if (!Array.isArray(rows)) return empty('unavailable');
    const urls = [...new Set(rows.map(row => row?.url).filter(url => {
      if (typeof url !== 'string') return false;
      try { assertPublicSupplierUrl(url); return true; } catch { return false; }
    }))].slice(0,3);
    return { status:'ok', urls };
  } catch {
    return empty('unavailable');
  }
}
