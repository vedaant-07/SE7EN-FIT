import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileWarning, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import TopBar from '@/components/se7enfit/TopBar';
import LoadingScreen from '@/components/se7enfit/LoadingScreen';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { engagementClient } from '@/api/engagementClient';

const safeArray = (value) => Array.isArray(value) ? value : [];

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(value);
  }
}

function severityClasses(severity) {
  if (severity === 'critical') return 'border-red-500/30 bg-red-500/10 text-red-300';
  if (severity === 'high') return 'border-orange-400/30 bg-orange-400/10 text-orange-300';
  if (severity === 'medium') return 'border-amber-400/30 bg-amber-400/10 text-amber-300';
  return 'border-border bg-muted text-muted-foreground';
}

export default function AdminEngagementIntegrity() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('flags');
  const [flags, setFlags] = useState([]);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');
  const [workingId, setWorkingId] = useState(null);

  const loadData = async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [flagRows, reportRows] = await Promise.all([
        engagementClient.getAdminIntegrityFlags('open'),
        engagementClient.getAdminReports('open'),
      ]);
      setFlags(safeArray(flagRows));
      setReports(safeArray(reportRows));
    } catch (loadError) {
      setError(loadError.message || 'Integrity review data could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const reviewFlag = async (flag, status) => {
    setWorkingId(flag.flag_id);
    try {
      await engagementClient.reviewIntegrityFlag(flag.flag_id, {
        status,
        review_notes: status === 'confirmed' ? 'Confirmed through the administrator competition review queue.' : 'Reviewed through the administrator competition review queue.',
      });
      setFlags((rows) => rows.filter((row) => row.flag_id !== flag.flag_id));
      toast({ title: status === 'confirmed' ? 'Integrity issue confirmed' : 'Integrity flag dismissed' });
    } catch (reviewError) {
      toast({ title: 'Could not review flag', description: reviewError.message, variant: 'destructive' });
    } finally {
      setWorkingId(null);
    }
  };

  const reviewReport = async (report, status) => {
    setWorkingId(report.report_id);
    try {
      await engagementClient.reviewReport(report.report_id, {
        status,
        resolution_notes: status === 'resolved' ? 'Reviewed and resolved by the SE7EN FIT competition team.' : 'Dismissed after administrator review.',
      });
      setReports((rows) => rows.filter((row) => row.report_id !== report.report_id));
      toast({ title: status === 'resolved' ? 'Report resolved' : 'Report dismissed' });
    } catch (reviewError) {
      toast({ title: 'Could not review report', description: reviewError.message, variant: 'destructive' });
    } finally {
      setWorkingId(null);
    }
  };

  if (loading) return <LoadingScreen />;

  const currentRows = tab === 'flags' ? flags : reports;

  return (
    <>
      <TopBar title="Competition Integrity" showBack backTo="/admin" />
      <main className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-4">
        <section className="relative overflow-hidden rounded-[28px] border border-red-400/20 bg-gradient-to-br from-red-400/[0.10] via-card to-card p-5">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-400/[0.05]" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-400/10 text-red-300"><ShieldAlert size={23} /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-300">Restricted administrator queue</p>
              <h1 className="mt-1 font-heading text-xl font-black">Review competition integrity</h1>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Investigate automated activity flags and member reports before confirming, dismissing or resolving them.</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-1.5">
          <button type="button" onClick={() => setTab('flags')} className={`min-h-11 rounded-xl text-xs font-black ${tab === 'flags' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>
            Automated flags ({flags.length})
          </button>
          <button type="button" onClick={() => setTab('reports')} className={`min-h-11 rounded-xl text-xs font-black ${tab === 'reports' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>
            Member reports ({reports.length})
          </button>
        </div>

        <div className="flex items-center justify-between px-1">
          <div><h2 className="font-heading text-sm font-black">Open review items</h2><p className="text-[10px] text-muted-foreground">{currentRows.length} awaiting action</p></div>
          <button type="button" onClick={() => loadData({ background: true })} disabled={refreshing} aria-label="Refresh integrity queue" className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /></button>
        </div>

        {error && <div role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4 text-xs text-destructive">{error}</div>}

        {currentRows.length === 0 ? (
          <section className="rounded-[24px] border border-border bg-card p-8 text-center">
            <CheckCircle2 size={34} className="mx-auto text-emerald-300" />
            <h2 className="mt-3 font-heading text-base font-black">Queue is clear</h2>
            <p className="mt-1 text-xs text-muted-foreground">There are no open {tab === 'flags' ? 'automated flags' : 'member reports'}.</p>
          </section>
        ) : tab === 'flags' ? flags.map((flag) => (
          <section key={flag.flag_id} className="rounded-[24px] border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${severityClasses(flag.severity)}`}><AlertTriangle size={17} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5"><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${severityClasses(flag.severity)}`}>{flag.severity}</span><span className="text-[9px] text-muted-foreground">{formatDate(flag.created_at)}</span></div>
                <h3 className="mt-2 break-words font-heading text-sm font-black">{String(flag.reason_code || 'integrity_flag').replace(/_/g, ' ')}</h3>
                <p className="mt-1 text-[10px] text-muted-foreground">{flag.source_type} • {flag.metric || 'general'} • {flag.event_date}</p>
                <p className="mt-2 break-all text-[10px] text-muted-foreground">User: {flag.user_id}</p>
              </div>
            </div>
            <details className="mt-3 rounded-xl bg-background/60 p-3 text-[10px] text-muted-foreground"><summary className="cursor-pointer font-bold">Evidence</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(flag.evidence || {}, null, 2)}</pre></details>
            <div className="mt-3 grid grid-cols-2 gap-2"><Button onClick={() => reviewFlag(flag, 'dismissed')} disabled={workingId === flag.flag_id} variant="outline" className="h-10 rounded-xl"><XCircle size={14} className="mr-2" /> Dismiss</Button><Button onClick={() => reviewFlag(flag, 'confirmed')} disabled={workingId === flag.flag_id} variant="destructive" className="h-10 rounded-xl"><ShieldAlert size={14} className="mr-2" /> Confirm</Button></div>
          </section>
        )) : reports.map((report) => (
          <section key={report.report_id} className="rounded-[24px] border border-border bg-card p-4">
            <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300"><FileWarning size={17} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-black uppercase text-amber-300">{report.reason_code?.replace(/_/g, ' ')}</span><span className="text-[9px] text-muted-foreground">{formatDate(report.created_at)}</span></div><h3 className="mt-2 font-heading text-sm font-black">{report.source_type?.replace(/_/g, ' ')} report</h3><p className="mt-1 break-words text-[11px] leading-relaxed text-muted-foreground">{report.details || 'No additional details were provided.'}</p><p className="mt-2 break-all text-[9px] text-muted-foreground">Reporter: {report.reporter_user_id}{report.reported_user_id ? ` • Reported: ${report.reported_user_id}` : ''}</p></div></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><Button onClick={() => reviewReport(report, 'dismissed')} disabled={workingId === report.report_id} variant="outline" className="h-10 rounded-xl"><XCircle size={14} className="mr-2" /> Dismiss</Button><Button onClick={() => reviewReport(report, 'resolved')} disabled={workingId === report.report_id} className="h-10 rounded-xl bg-accent text-accent-foreground"><CheckCircle2 size={14} className="mr-2" /> Resolve</Button></div>
          </section>
        ))}
      </main>
    </>
  );
}
