import { loadWeather } from '../lib/weather.js';

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const payload = await loadWeather();
  const available = ['current', 'today', 'sevenDays', 'warnings', 'hourly', 'uv', 'air', 'airForecast', 'stations'].some(key => payload[key]);
  // Do not cache partial outages; retry missing sources on the next request.
  res.setHeader('Cache-Control', available && !payload.unavailable.length
    ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=300' : 'no-store');
  res.status(available ? 200 : 503);
  return req.method === 'HEAD' ? res.end() : res.json(payload);
}
