import { requireLeadsUser } from '@/lib/auth';
import { filters, findLeads, getLead, leadCounts } from '@/lib/leads';
import { saveLead } from './actions';
import { LeadsBoard } from './board';
import { Top } from './ui';

export const metadata = { title: 'Leads | SOS Foundation' };

export default async function Leads({ searchParams }) {
  const user = await requireLeadsUser();
  const params = await searchParams;
  const f = filters(params);
  const [counts, rows, lead] = await Promise.all([leadCounts(), findLeads(f), params.id ? getLead(params.id) : null]);
  const keep = [f.form && 'form=' + encodeURIComponent(f.form), f.status && 'status=' + encodeURIComponent(f.status), f.search && 'q=' + encodeURIComponent(f.search)].filter(Boolean).join('&');
  return (
    <div className={'lp' + (lead ? ' lp-open' : '')}>
      <Top user={user} />
      <main className="lp-main">
        <LeadsBoard base="/leads" params={params} f={f} counts={counts} rows={rows} lead={lead} head exportHref={'/leads/export' + (keep ? '?' + keep : '')} save={saveLead} remove={null} />
      </main>
    </div>
  );
}
