import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import useStore from '../state/store';
import { isCourseIssueAdminEmail } from '../utils/adminAccess';
import { listCourseIssueReports, updateCourseIssueReportStatus, type CourseIssueAdminReport } from '../utils/courseIssueAdmin';
import { formatLocalDate } from '../utils/dateUtils';
import { useOptionalAuth } from '../contexts/AuthContext';

const badgeClasses: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800 border-amber-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
};

const CourseIssueAdminPage: React.FC = () => {
  const currentUser = useStore((s) => s.currentUser);
  const currentProfile = useStore((s) => s.currentProfile);
  const addToast = useStore((s) => s.addToast);
  const auth = useOptionalAuth();
  const authUser = auth?.user;

  const [reports, setReports] = useState<CourseIssueAdminReport[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const accessEmail = (authUser?.email || currentProfile?.email || currentUser?.username || '').trim().toLowerCase();
  const isAdmin = isCourseIssueAdminEmail(accessEmail);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listCourseIssueReports();
        if (!cancelled) setReports(data);
      } catch (error: any) {
        console.error('Failed to load course issue reports:', error);
        if (!cancelled) addToast(error?.message || 'Could not load course issue reports.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, addToast]);

  const visibleReports = useMemo(() => {
    if (statusFilter === 'all') return reports;
    return reports.filter((report) => (report.status || 'open') === statusFilter);
  }, [reports, statusFilter]);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleDownload = (report: CourseIssueAdminReport) => {
    if (!report.imageDataUrl) {
      addToast('No image attached to this report.', 'error');
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = report.imageDataUrl;
    anchor.download = report.imageName || `${report.courseName || 'course-issue'}-${report.id}.jpg`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleToggleStatus = async (report: CourseIssueAdminReport) => {
    const nextStatus = (report.status || 'open') === 'completed' ? 'open' : 'completed';
    setSavingId(report.id);
    try {
      await updateCourseIssueReportStatus(report.id, nextStatus);
      setReports((current) =>
        current.map((candidate) =>
          candidate.id === report.id ? { ...candidate, status: nextStatus, updatedAt: new Date().toISOString() } : candidate
        )
      );
      addToast(`Report marked ${nextStatus}.`, 'success');
    } catch (error: any) {
      console.error('Failed to update course issue report:', error);
      addToast(error?.message || 'Could not update report.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="flex items-center justify-center w-10 h-10 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors"
          aria-label="Back to home"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Course Issue Inbox</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Review scorecard photos and mark fixes complete.</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(['all', 'open', 'completed'] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setStatusFilter(filter)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
              statusFilter === filter
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {filter === 'all' ? 'All' : filter === 'open' ? 'Open' : 'Completed'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Loading course issues...</div>
      ) : visibleReports.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No course issue reports found.</div>
      ) : (
        <div className="space-y-4">
          {visibleReports.map((report) => {
            const status = report.status || 'open';
            return (
              <div key={report.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-gray-900">{report.courseName || 'Unknown course'}</h2>
                      {report.teeName && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{report.teeName}</span>
                      )}
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${badgeClasses[status] || badgeClasses.open}`}>
                        {status.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {report.reporterName || report.reporterEmail || 'Unknown reporter'} • {report.source === 'add_score' ? 'Add Score' : 'Create Event'} •{' '}
                      {report.createdAt ? formatLocalDate(report.createdAt.slice(0, 10), { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown date'}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(report)}
                      disabled={savingId === report.id}
                      className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {savingId === report.id ? 'Saving...' : status === 'completed' ? 'Reopen' : 'Mark Complete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(report)}
                      className="rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                    >
                      Download Image
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-4 lg:grid-cols-[1fr,320px]">
                  <div className="space-y-2 text-sm text-gray-700">
                    <div>
                      <span className="font-semibold text-gray-900">Issue:</span> {report.issueType || 'other'}
                    </div>
                    {report.reporterEmail && (
                      <div>
                        <span className="font-semibold text-gray-900">Reporter email:</span> {report.reporterEmail}
                      </div>
                    )}
                    {report.notes && (
                      <div>
                        <div className="font-semibold text-gray-900 mb-1">Notes</div>
                        <div className="rounded-xl bg-slate-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">{report.notes}</div>
                      </div>
                    )}
                  </div>

                  <div>
                    {report.imageDataUrl ? (
                      <button type="button" onClick={() => handleDownload(report)} className="block w-full">
                        <img
                          src={report.imageDataUrl}
                          alt={report.imageName || 'Scorecard attachment'}
                          className="w-full rounded-xl border border-gray-200 object-contain max-h-72 bg-slate-50"
                        />
                      </button>
                    ) : (
                      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-slate-50 text-sm text-gray-500">
                        No image attached
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CourseIssueAdminPage;
