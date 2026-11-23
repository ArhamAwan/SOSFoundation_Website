// The list of fixed pages for Pages, Programmes and Board and messages. Each opens the page editor.
import Link from 'next/link';
import { changeCounts, pagesFor } from '@/lib/overrides';
import { Badge, Head } from '@/app/admin/_ui';

export async function PageList({ section, title, sub, back }) {
  const [groups, counts] = [pagesFor(section), await changeCounts()];
  return (
    <>
      <Head title={title} sub={sub} />
      {groups.map(([name, pages]) => (
        <section className="panel" key={name || 'all'} style={{ marginBottom: 20 }}>
          {name ? <h2>{name}</h2> : null}
          <div className="tablewrap">
            <table className="tbl" style={{ tableLayout: 'fixed' }}>
              <colgroup><col style={{ width: '38%' }} /><col style={{ width: '34%' }} /><col style={{ width: '17%' }} /><col style={{ width: 90 }} /></colgroup>
              <thead><tr><th>Page</th><th>Address</th><th>Text and photos</th><th><span className="sr">Edit</span></th></tr></thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.path}>
                    <td><Link href={`/admin/pages/edit?p=${encodeURIComponent(p.path)}&from=${encodeURIComponent(back)}`} style={{ fontWeight: 700 }}>{p.path === '' ? 'Home' : p.title}</Link></td>
                    <td className="muted small" style={{ overflowWrap: 'anywhere' }}>/{p.path}</td>
                    <td>{counts[p.path] ? <Badge kind="info">{counts[p.path]} changed</Badge> : <span className="muted small">As designed</span>}</td>
                    <td style={{ textAlign: 'right' }}><Link className="btn plain" href={`/admin/pages/edit?p=${encodeURIComponent(p.path)}&from=${encodeURIComponent(back)}`}>Edit</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
