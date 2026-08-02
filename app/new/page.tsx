'use client';

import { useState, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';

const TIMEZONES = [
  'Africa/Casablanca',
  'Europe/Paris',
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Riyadh',
  'UTC',
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [timezone, setTimezone] = useState('Africa/Casablanca');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
    if (e.key === 'Backspace' && tagInput === '') {
      setTags(tags.slice(0, -1));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!city.trim()) return setError('City is required.');
    if (tags.length === 0) return setError('Add at least one business type.');
    setError('');
    setLoading(true);

    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: city.trim(), business_types: tags, timezone }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Failed to create campaign.');
      setLoading(false);
      return;
    }

    router.push('/');
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Campaign</h1>

      <form onSubmit={submit} className="space-y-5">
        {/* City */}
        <div>
          <label className="block text-sm font-medium mb-1">
            City <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Casablanca"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        {/* Business types */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Business types <span className="text-red-500">*</span>
          </label>
          <div className="min-h-[42px] w-full border border-gray-300 rounded-lg px-3 py-2 flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:ring-green-400 bg-white">
            {tags.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full"
              >
                {t}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  className="hover:text-red-600 leading-none"
                >
                  &times;
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={addTag}
              placeholder={tags.length === 0 ? 'Type and press Enter (e.g. restaurant)' : ''}
              className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Press Enter or comma to add each type.</p>
        </div>

        {/* Timezone */}
        <div>
          <label className="block text-sm font-medium mb-1">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white font-semibold py-2.5 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
        >
          {loading ? 'Creating campaign & scraping...' : 'Create campaign'}
        </button>
      </form>
    </div>
  );
}
