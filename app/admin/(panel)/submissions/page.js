// Leads in the admin panel: the same list and lead view as the Leads portal (app/leads/board.js), plus Delete for admins.
import '@/app/leads/leads.css';
import { requireUser } from '@/lib/auth';
import { filters, findLeads, getLead, leadCounts } from '@/lib/leads';
import { Head, Icon } from '@/app/admin/_ui';
import { ConfirmButton } from '@/app/admin/_ui/client';
import { deleteSubmission, updateSubmission } from '@/app/admin/actions';
import { LeadsBoard } from '@/app/leads/board';
import { Ico } from '@/app/leads/ui';

export default async function Submissions({ searchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const f = filters(params);
  const [counts, rows, lead] = await Promise.all([leadCounts(), findLeads(f), params.id ? getLead(params.id) : null]);
  const keep = [f.form && 'form=' + encodeURIComponent(f.form), f.status && 'status=' + encodeURIComponent(f.status), f.search && 'q=' + encodeURIComponent(f.search)].filter(Boolean).join('&');
  const remove = user.isAdmin && lead ? (
    <ConfirmButton className="lp-btn danger" style={{ marginLeft: 'auto' }} formAction={deleteSubmission} message="Delete this lead? This cannot be undone.">
      <Ico name="trash" />Delete lead
    </ConfirmButton>
  ) : null;
  return (
    <>
      <Head title="Leads" sub="Everyone who filled in a form on the website. New ones are at the top.">
        <a className="btn plain" href="/leads" target="_blank" rel="noreferrer"><Icon name="ext" />Open the Leads portal</a>
        <a className="btn plain" href={'/admin/submissions/export' + (keep ? '?' + keep : '')}><Icon name="Download" />Export CSV</a>
      </Head>
      <div className={'lp lp-adm' + (lead ? ' lp-open' : '')}>
        <LeadsBoard base="/admin/submissions" params={params} f={f} counts={counts} rows={rows} lead={lead} head={false} save={updateSubmission} remove={remove} />
      </div>
    </>
  );
}
