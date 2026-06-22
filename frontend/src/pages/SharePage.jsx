import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  GitBranch, TestTube2, FileText, Zap, Eye, Clock,
  ExternalLink, Terminal, BarChart2, Info, Code2, ListChecks
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../services/api';
import CopyButton from '../components/shared/CopyButton';

const TOOL_META = {
  branch: { label: 'BranchNamer', icon: GitBranch, color: 'text-brand-400', bg: 'bg-brand-500/10', border: 'border-brand-500/20' },
  tests: { label: 'TestCraft', icon: TestTube2, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  pr: { label: 'PR Describer', icon: FileText, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
};

function BranchResult({ content }) {
  return (
    <div className="space-y-3">
      <div className="glass-card p-4 mb-4">
        <p className="text-xs text-slate-500 mb-1">Task</p>
        <p className="text-slate-300">{content.input?.taskDescription}</p>
        {content.input?.ticketId && (
          <span className="badge badge-blue mt-2">{content.input.ticketId}</span>
        )}
      </div>
      {(content.branches || []).map((b, i) => (
        <div key={i} className="glass-card p-4">
          <div className="flex items-center justify-between gap-3">
            <code className="font-mono text-sm text-slate-200">{b.name}</code>
            <CopyButton text={b.name} label="Copy" />
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            <Terminal className="w-3 h-3" />
            <code>{b.fullCommand}</code>
          </div>
        </div>
      ))}
    </div>
  );
}

function TestResult({ content }) {
  return (
    <div className="space-y-4">
      <div className="glass-card p-4 flex flex-wrap gap-6">
        <div>
          <p className="text-xs text-slate-500 mb-1">Function</p>
          <p className="font-mono text-slate-200">{content.input?.functionName}()</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Coverage</p>
          <p className={`font-semibold ${content.output?.estimatedCoverage >= 80 ? 'text-brand-400' : 'text-orange-400'}`}>
            {content.output?.estimatedCoverage || 0}%
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Tests</p>
          <p className="text-slate-300">{content.output?.testCases?.length || 0}</p>
        </div>
      </div>
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
          <span className="text-sm font-mono text-slate-400">Test File</span>
          <CopyButton text={content.output?.fullTestFile || ''} label="Copy" />
        </div>
        <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-[500px] overflow-y-auto leading-relaxed">
          {content.output?.fullTestFile}
        </pre>
      </div>
    </div>
  );
}

function PRResult({ content }) {
  return (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <h2 className="text-lg font-semibold text-white mb-2">{content.output?.title}</h2>
        <p className="text-slate-400 text-sm">{content.output?.summary}</p>
      </div>
      {content.output?.whatChanged && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2"><Code2 className="w-4 h-4 text-purple-400" /><span className="text-sm font-semibold text-slate-300">What Changed</span></div>
          <p className="text-sm text-slate-400">{content.output.whatChanged}</p>
        </div>
      )}
      {content.output?.reviewerChecklist?.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3"><ListChecks className="w-4 h-4 text-purple-400" /><span className="text-sm font-semibold text-slate-300">Reviewer Checklist</span></div>
          <div className="space-y-2">
            {content.output.reviewerChecklist.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-slate-400">
                <span className="text-purple-400 mt-0.5">☐</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
          <span className="text-sm font-mono text-slate-400">Full Markdown</span>
          <CopyButton text={content.output?.markdownFull || ''} label="Copy MD" />
        </div>
        <pre className="p-4 text-xs font-mono text-slate-400 overflow-x-auto max-h-64 overflow-y-auto">
          {content.output?.markdownFull}
        </pre>
      </div>
    </div>
  );
}

const RESULT_COMPONENTS = { branch: BranchResult, tests: TestResult, pr: PRResult };

export default function SharePage() {
  const { shareId } = useParams();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/share/${shareId}`);
        setData(res.data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Share link not found or has expired.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [shareId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h2 className="text-xl font-semibold text-slate-300 mb-2">Link not found</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <Link to="/" className="btn-primary text-sm">Go to DevForge AI</Link>
        </div>
      </div>
    );
  }

  const meta = TOOL_META[data.tool] || {};
  const Icon = meta.icon || Zap;
  const ResultComponent = RESULT_COMPONENTS[data.tool];

  return (
    <div className="min-h-screen bg-surface-900">
      {/* Top bar */}
      <div className="border-b border-white/5 bg-surface-800/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-1.5 ${meta.bg} border ${meta.border} rounded-lg`}>
              <Icon className={`w-4 h-4 ${meta.color}`} />
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-200">{meta.label}</span>
              <span className="text-slate-600 mx-2">•</span>
              <span className="text-sm text-slate-500">shared by {data.sharedBy}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Eye className="w-3.5 h-3.5" />
              {data.viewCount} views
            </div>
            <Link to="/register" className="btn-primary text-xs py-1.5">
              <Zap className="w-3.5 h-3.5" />
              Try DevForge AI free
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Meta info */}
        <div className="flex items-center gap-4 mb-6 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Shared {formatDistanceToNow(new Date(data.createdAt), { addSuffix: true })}
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Expires {formatDistanceToNow(new Date(data.expiresAt), { addSuffix: true })}
          </div>
        </div>

        {ResultComponent && <ResultComponent content={data.content} />}

        {/* CTA */}
        <div className="glass-card p-6 mt-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-brand-400" />
            <span className="font-display font-bold text-white">DevForge AI</span>
          </div>
          <p className="text-slate-400 text-sm mb-4">AI-powered Git branch names, test suites, and PR descriptions</p>
          <Link to="/register" className="btn-primary text-sm">
            Get Started Free — 20 AI requests/day
          </Link>
        </div>
      </div>
    </div>
  );
}
