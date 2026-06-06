import { ApiFootballAdapter } from './providers/api-football';

export function getSportsAdapter(): ApiFootballAdapter {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error('API_FOOTBALL_KEY environment variable is not set.');
  return new ApiFootballAdapter(key);
}
