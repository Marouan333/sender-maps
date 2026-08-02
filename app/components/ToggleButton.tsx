'use client';

import { useState } from 'react';

export function ToggleButton({
  campaignId,
  currentStatus,
}: {
  campaignId: string;
  currentStatus: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  const isActive = status === 'active';

  async function toggle() {
    const next = isActive ? 'paused' : 'active';
    setLoading(true);
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) setStatus(next);
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading || status === 'done'}
      className={`text-sm px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50 ${
        isActive
          ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
          : 'bg-green-100 text-green-800 hover:bg-green-200'
      }`}
    >
      {loading ? '...' : isActive ? 'Pause' : 'Resume'}
    </button>
  );
}
