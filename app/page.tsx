import { supabase } from '@/lib/supabase';
import { ToggleButton } from './components/ToggleButton';

interface CampaignRow {
  id: string;
  city: string;
  business_types: string[];
  timezone: string;
  status: 'active' | 'paused' | 'done';
  created_at: string;
  total: number;
  sent: number;
  pending: number;
  failed: number;
  skipped: number;
}

async function getCampaigns(): Promise<CampaignRow[]> {
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (!campaigns?.length) return [];

  const ids = campaigns.map((c) => c.id);
  const { data: leads } = await supabase
    .from('leads')
    .select('campaign_id, status')
    .in('campaign_id', ids);

  const stats: Record<
    string,
    { total: number; sent: number; pending: number; failed: number; skipped: number }
  > = {};

  for (const lead of leads ?? []) {
    if (!stats[lead.campaign_id])
      stats[lead.campaign_id] = { total: 0, sent: 0, pending: 0, failed: 0, skipped: 0 };
    stats[lead.campaign_id].total++;
    (stats[lead.campaign_id] as Record<string, number>)[lead.status]++;
  }

  return campaigns.map((c) => ({
    ...c,
    ...(stats[c.id] ?? { total: 0, sent: 0, pending: 0, failed: 0, skipped: 0 }),
  }));
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  done: 'bg-gray-100 text-gray-600',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const campaigns = await getCampaigns();

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <a
          href="/api/whatsapp/qr"
          target="_blank"
          className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 transition"
        >
          WA status / QR
        </a>
      </div>

      {campaigns.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-5xl mb-4">📭</p>
          <p className="font-medium text-lg">No campaigns yet.</p>
          <a href="/new" className="mt-4 inline-block text-green-600 underline font-medium">
            Create your first campaign
          </a>
        </div>
      )}

      <div className="space-y-4">
        {campaigns.map((c) => {
          // Progress is based on non-skipped leads only
          const actionable = c.total - c.skipped;
          const pct = actionable > 0 ? Math.round((c.sent / actionable) * 100) : 0;

          return (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-semibold text-lg leading-tight">{c.city}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{c.business_types.join(' · ')}</p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[c.status]}`}
                >
                  {c.status}
                </span>
              </div>

              {/* Progress bar — only over actionable (no-website) leads */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{c.sent} sent</span>
                  <span>
                    {actionable} without website · {c.skipped} with website
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 flex gap-4 text-sm flex-wrap">
                <Stat label="Total" value={c.total} color="text-gray-700" />
                <Stat label="Pending" value={c.pending} color="text-blue-600" />
                <Stat label="Sent" value={c.sent} color="text-green-600" />
                <Stat label="Failed" value={c.failed} color="text-red-500" />
                <Stat label="Has website" value={c.skipped} color="text-gray-400" />
              </div>

              <div className="mt-4 flex gap-2 flex-wrap">
                <ToggleButton campaignId={c.id} currentStatus={c.status} />
                <a
                  href={`/api/leads/export?campaign_id=${c.id}`}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                >
                  Export CSV
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {campaigns.length > 0 && (
        <div className="mt-6 text-center">
          <a
            href="/api/leads/export"
            className="text-sm text-gray-500 underline hover:text-gray-700"
          >
            Export all leads (all campaigns)
          </a>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="flex gap-1.5">
      <span className="text-gray-400">{label}:</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </span>
  );
}
