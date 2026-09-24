import { type FC, useState, useMemo, useEffect } from 'react';
import { useLanguage } from '@/hooks';
import { FadeIn } from '@/components/common';

type IssueStatus = 'open' | 'in-progress' | 'resolved' | 'closed';
type IssuePriority = 'critical' | 'high' | 'normal' | 'low';

interface Issue {
  id: string;
  title: { en: string; ko: string };
  description: { en: string; ko: string };
  status: IssueStatus;
  priority: IssuePriority;
  package: string;
  reportedAt: string;
  resolvedAt?: string;
}

const STATUS_CONFIG: Record<IssueStatus, { label: { en: string; ko: string }; color: string; icon: string }> = {
  'open': { label: { en: 'Open', ko: '접수' }, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: 'fa-circle-dot' },
  'in-progress': { label: { en: 'In Progress', ko: '진행 중' }, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: 'fa-spinner' },
  'resolved': { label: { en: 'Resolved', ko: '해결됨' }, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: 'fa-check-circle' },
  'closed': { label: { en: 'Closed', ko: '닫힘' }, color: 'text-text-muted bg-white/[0.04] border-white/[0.08]', icon: 'fa-circle-xmark' },
};

const PRIORITY_CONFIG: Record<IssuePriority, { label: { en: string; ko: string }; color: string }> = {
  'critical': { label: { en: 'Critical', ko: '심각' }, color: 'text-red-400' },
  'high': { label: { en: 'High', ko: '높음' }, color: 'text-orange-400' },
  'normal': { label: { en: 'Normal', ko: '보통' }, color: 'text-text-secondary' },
  'low': { label: { en: 'Low', ko: '낮음' }, color: 'text-text-muted' },
};

const Issues: FC = () => {
  const { lang } = useLanguage();
  const [filter, setFilter] = useState<'all' | IssueStatus>('all');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/issues.json')
      .then((res) => res.json())
      .then((data: Issue[]) => {
        setIssues(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredIssues = useMemo(() => {
    if (filter === 'all') return issues;
    return issues.filter((i) => i.status === filter);
  }, [filter, issues]);

  const counts = useMemo(() => ({
    all: issues.length,
    open: issues.filter((i) => i.status === 'open').length,
    'in-progress': issues.filter((i) => i.status === 'in-progress').length,
    resolved: issues.filter((i) => i.status === 'resolved').length,
  }), [issues]);

  return (
    <div>
      {/* Hero */}
      <section className="pt-32 pb-16 relative overflow-hidden">
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-air-500/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="section-container relative z-10 max-w-4xl">
          <FadeIn>
            <p className="font-mono text-[11px] text-text-muted tracking-wider uppercase mb-5">Issue Tracker</p>
          </FadeIn>
          <FadeIn delay={80}>
            <h1 className="font-display text-[1.5rem] sm:text-[1.8rem] lg:text-[2.1rem] font-extrabold leading-[1.25] tracking-tight text-text-primary mb-4">
              {lang === 'ko' ? '공개 이슈 트래커' : 'Public Issue Tracker'}
            </h1>
          </FadeIn>
          <FadeIn delay={160}>
            <p className="text-text-secondary text-[15px] sm:text-base leading-[1.8] max-w-3xl mb-6">
              {lang === 'ko'
                ? '접수된 버그와 기능 요청을 공개적으로 추적합니다. 새로운 이슈를 제보하려면 labs@codepedia.kr로 이메일을 보내주세요.'
                : 'We track all reported bugs and feature requests publicly. To report a new issue, email labs@codepedia.kr with reproduction steps.'}
            </p>
            <a href="mailto:labs@codepedia.kr" className="btn-primary">
              <i className="fa-solid fa-envelope text-xs" />
              {lang === 'ko' ? '이슈 제보하기' : 'Report an Issue'}
            </a>
          </FadeIn>
        </div>
      </section>

      {/* Filters */}
      <section className="border-t border-white/[0.04]">
        <div className="section-container max-w-4xl py-6">
          <FadeIn>
            <div className="flex flex-wrap gap-2">
              {(['all', 'open', 'in-progress', 'resolved'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-200
                    ${filter === f
                      ? 'bg-air-500/10 border border-air-500/20 text-air-400'
                      : 'bg-white/[0.02] border border-white/[0.06] text-text-muted hover:text-text-secondary hover:border-white/[0.1]'
                    }`}
                >
                  {f === 'all' ? (lang === 'ko' ? '전체' : 'All') :
                   f === 'in-progress' ? (lang === 'ko' ? '진행 중' : 'In Progress') :
                   STATUS_CONFIG[f].label[lang]}
                  <span className="ml-1.5 text-[10px] opacity-60">
                    {f === 'all' ? counts.all : counts[f as keyof typeof counts] || 0}
                  </span>
                </button>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Issue List */}
      <section className="border-t border-white/[0.04] pb-20">
        <div className="section-container max-w-4xl py-8">
          {loading ? (
            <div className="text-center py-16 text-text-muted text-sm">
              {lang === 'ko' ? '이슈를 불러오는 중...' : 'Loading issues...'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredIssues.map((issue, i) => {
                const sc = STATUS_CONFIG[issue.status];
                const pc = PRIORITY_CONFIG[issue.priority];
                return (
                  <FadeIn key={issue.id} delay={i * 60}>
                    <div className="group p-5 rounded-xl bg-white/[0.015] border border-white/[0.04]
                                    hover:border-air-500/10 hover:bg-white/[0.025] transition-all duration-300">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-[11px] text-text-muted/50 flex-shrink-0">{issue.id}</span>
                          <h3 className="font-display text-sm font-bold text-text-primary truncate">
                            {issue.title[lang]}
                          </h3>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-mono uppercase flex-shrink-0 ${sc.color}`}>
                          <i className={`fa-solid ${sc.icon} text-[8px]`} />
                          {sc.label[lang]}
                        </span>
                      </div>
                      <p className="text-text-muted text-[13px] leading-relaxed mb-3">
                        {issue.description[lang]}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted/60">
                        <span className="font-mono">{issue.package}</span>
                        <span className={pc.color}>{pc.label[lang]}</span>
                        <span>{lang === 'ko' ? '접수' : 'Reported'}: {issue.reportedAt}</span>
                        {issue.resolvedAt && (
                          <span className="text-emerald-400/60">{lang === 'ko' ? '해결' : 'Resolved'}: {issue.resolvedAt}</span>
                        )}
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          )}

          {!loading && filteredIssues.length === 0 && (
            <FadeIn>
              <div className="text-center py-16 text-text-muted text-sm">
                {lang === 'ko' ? '해당 상태의 이슈가 없습니다.' : 'No issues with this status.'}
              </div>
            </FadeIn>
          )}
        </div>
      </section>
    </div>
  );
};

export default Issues;
