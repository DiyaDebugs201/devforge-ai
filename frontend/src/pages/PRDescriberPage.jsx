import { useState } from 'react';
import {
  FileText, Wand2, Link, GitPullRequest,
  ChevronDown, ChevronUp, ClipboardList, ListChecks,
  Lightbulb, Info, Code2, ExternalLink, AlertCircle,
  ToggleLeft, ToggleRight, Download
} from 'lucide-react';
import api from '../services/api';
import CopyButton from '../components/shared/CopyButton';
import ShareButton from '../components/shared/ShareButton';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

// ── sample diff ────────────────────────────────────────────────────────────
const DIFF_PLACEHOLDER = `diff --git a/src/auth/login.js b/src/auth/login.js
index 3a4b5c6..7d8e9f0 100644
--- a/src/auth/login.js
+++ b/src/auth/login.js
@@ -12,8 +12,15 @@ const login = async (req, res) => {
   const { email, password } = req.body;
-  const user = await User.findOne({ email });
-  if (!user || !(await bcrypt.compare(password, user.password))) {
+  const normalizedEmail = email.toLowerCase().trim();
+  const user = await User.findOne({ email: normalizedEmail }).select('+password');
+
+  if (!user || !user.isActive) {
     return res.status(401).json({ message: 'Invalid credentials' });
   }
+
+  const isValid = await user.comparePassword(password);
+  if (!isValid) {
+    return res.status(401).json({ message: 'Invalid credentials' });
+  }`;

// ── validate GitHub URL (client-side check matching server logic) ───────────
function isGitHubUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === 'github.com' || parsed.hostname === 'www.github.com') &&
      parsed.protocol === 'https:'
    );
  } catch {
    return false;
  }
}

// ── download helper ────────────────────────────────────────────────────────
function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ═════════════════════════════════════════════════════════════════════════
export default function PRDescriberPage() {
  const [inputMode,   setInputMode]   = useState('diff');   // 'diff' | 'url'
  const [rawDiff,     setRawDiff]     = useState('');
  const [prUrl,       setPrUrl]       = useState('');
  const [descMode,    setDescMode]    = useState('concise');
  const [isLoading,   setIsLoading]   = useState(false);
  const [result,      setResult]      = useState(null);
  const [historyId,   setHistoryId]   = useState(null);
  const [urlError,    setUrlError]    = useState('');

  const [expanded, setExpanded] = useState({
    summary: true, whatChanged: true,
    whyChanged: true, testingSteps: true, checklist: true,
  });
  const toggle = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  // ── client-side URL validation ──────────────────────────────────────────
  const handleUrlChange = (val) => {
    setPrUrl(val);
    if (!val.trim()) { setUrlError(''); return; }
    if (!isGitHubUrl(val.trim())) {
      setUrlError('Must be a GitHub URL (https://github.com/...)');
    } else {
      setUrlError('');
    }
  };

  // ── generate ────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    const payload = { mode: descMode };

    if (inputMode === 'diff') {
      if (!rawDiff.trim() || rawDiff.trim().length < 10) {
        toast.error('Please paste a git diff to analyze.');
        return;
      }
      payload.rawDiff = rawDiff.trim();
    } else {
      const trimmedUrl = prUrl.trim();
      if (!trimmedUrl) {
        toast.error('Please enter a GitHub URL.');
        return;
      }
      if (!isGitHubUrl(trimmedUrl)) {
        toast.error('Only GitHub URLs are supported (https://github.com/...)');
        return;
      }
      payload.prUrl = trimmedUrl;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const res = await api.post('/pr/generate', payload);
      setResult(res.data.data);
      setHistoryId(res.data.data.historyId);
      toast.success('PR description generated!');
    } catch (err) {
      const msg = err.response?.data?.message || 'Generation failed. Please try again.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── collapsible section ─────────────────────────────────────────────────
  const Section = ({ id, icon: Icon, title, children }) => (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => toggle(id)}
        className="w-full flex items-center justify-between px-4 py-3
                   hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-slate-300">{title}</span>
        </div>
        {expanded[id]
          ? <ChevronUp   className="w-4 h-4 text-slate-500" />
          : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {expanded[id] && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white">PR Describer</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Paste a git diff or a GitHub URL — get a structured PR description with checklist.
          </p>
        </div>
      </div>

      {/* ── Input form ────────────────────────────────────────────── */}
      <div className="glass-card p-6 mb-6">

        {/* Mode toggle: Diff vs URL */}
        <div className="flex gap-1 bg-surface-900 border border-white/5 rounded-lg p-1 mb-5 w-fit">
          {[
            { id: 'diff', icon: Code2, label: 'Git Diff' },
            { id: 'url',  icon: Link,  label: 'GitHub URL' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => { setInputMode(id); setUrlError(''); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                inputMode === id
                  ? 'bg-surface-600 text-slate-200'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Git diff textarea ──────────────────────────────────── */}
        {inputMode === 'diff' && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="label-base">Paste Git Diff</label>
              <button
                onClick={() => setRawDiff(DIFF_PLACEHOLDER)}
                className="text-xs text-slate-500 hover:text-brand-400 transition-colors"
              >
                Load example
              </button>
            </div>
            <textarea
              value={rawDiff}
              onChange={(e) => setRawDiff(e.target.value)}
              placeholder={DIFF_PLACEHOLDER}
              rows={9}
              className="input-base font-mono text-xs resize-y"
            />
            <p className="text-xs text-slate-600 mt-1">
              Run{' '}
              <code className="bg-surface-700 px-1 rounded text-slate-400">
                git diff main..HEAD
              </code>{' '}
              to capture your changes.
            </p>
          </div>
        )}

        {/* ── GitHub URL input ───────────────────────────────────── */}
        {inputMode === 'url' && (
          <div className="mb-4">
            <label className="label-base">GitHub URL</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="url"
                  value={prUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://github.com/owner/repo/pull/123"
                  className={`input-base w-full ${urlError ? 'border-red-500/50 focus:border-red-500/70' : ''}`}
                />
                {urlError && (
                  <p className="flex items-center gap-1 text-xs text-red-400 mt-1">
                    <AlertCircle className="w-3 h-3" /> {urlError}
                  </p>
                )}
              </div>
              {prUrl && !urlError && (
                <a
                  href={prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary px-3 flex-shrink-0"
                  title="Open in GitHub"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* Helper text */}
            <div className="mt-2 p-3 bg-surface-700/50 rounded-lg border border-white/5">
              <p className="text-xs text-slate-400 mb-1 font-medium">Accepted formats:</p>
              <ul className="text-xs text-slate-500 space-y-0.5">
                <li>• https://github.com/owner/repo/pull/123</li>
                <li>• https://github.com/owner/repo (any public repository)</li>
              </ul>
              <p className="text-xs text-slate-600 mt-2">
                For best results, paste the git diff instead of a URL.
                The AI will infer context from the URL when no diff is available.
              </p>
            </div>
          </div>
        )}

        {/* ── Concise / Detailed toggle ──────────────────────────── */}
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Mode:</span>
            <span className={`text-sm font-medium ${
              descMode === 'detailed' ? 'text-purple-400' : 'text-slate-300'
            }`}>
              {descMode === 'concise' ? 'Concise' : 'Detailed'}
            </span>
          </div>
          <button
            onClick={() => setDescMode(descMode === 'concise' ? 'detailed' : 'concise')}
            className="text-purple-400 hover:text-purple-300 transition-colors"
            title="Toggle description detail level"
          >
            {descMode === 'concise'
              ? <ToggleLeft  className="w-7 h-7" />
              : <ToggleRight className="w-7 h-7" />}
          </button>
        </div>
      </div>

      {/* ── Generate button ────────────────────────────────────────── */}
      <button
        onClick={handleGenerate}
        disabled={isLoading || !!urlError}
        className="btn-primary w-full justify-center mb-8 py-3 bg-purple-600 hover:bg-purple-500
                   focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading
          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
          : <><Wand2 className="w-4 h-4" /> Generate PR Description</>}
      </button>

      {/* ── Loading ────────────────────────────────────────────────── */}
      {isLoading && (
        <LoadingSpinner
          text="Writing your PR description…"
          subtext="Analyzing changes and structuring sections"
        />
      )}

      {/* ── Result ────────────────────────────────────────────────── */}
      {result && !isLoading && (
        <div className="animate-slide-up space-y-4">

          {/* Title + actions */}
          <div className="glass-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <GitPullRequest className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider">PR Title</span>
                </div>
                <h2 className="text-lg font-semibold text-white leading-snug">{result.title}</h2>
              </div>
              <div className="flex flex-col gap-2 items-end flex-shrink-0">
                {historyId && <ShareButton tool="pr" historyId={historyId} />}
                <div className="flex gap-1.5">
                  <CopyButton text={result.markdownFull || ''} label="MD"   size="sm" />
                  <CopyButton text={result.plainTextFull || ''} label="Text" size="sm" />
                  <button
                    onClick={() => downloadFile(result.markdownFull || '', 'pr-description.md')}
                    className="btn-ghost text-slate-400 text-xs"
                    title="Download as .md"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {result.summary && (
            <Section id="summary" icon={Info} title="Summary">
              <p className="text-sm text-slate-300 leading-relaxed">{result.summary}</p>
            </Section>
          )}

          {result.whatChanged && (
            <Section id="whatChanged" icon={Code2} title="What Changed">
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {result.whatChanged}
              </p>
            </Section>
          )}

          {result.whyChanged && (
            <Section id="whyChanged" icon={Lightbulb} title="Why This Change">
              <p className="text-sm text-slate-300 leading-relaxed">{result.whyChanged}</p>
            </Section>
          )}

          {result.testingSteps && (
            <Section id="testingSteps" icon={ClipboardList} title="Testing Steps">
              <div className="space-y-2">
                {result.testingSteps.split('\n').filter(Boolean).map((step, i) => (
                  <div key={i} className="flex gap-3 text-sm text-slate-300">
                    <span className="text-purple-400 font-mono flex-shrink-0 w-5">{i + 1}.</span>
                    <span>{step.replace(/^\d+\.\s*/, '')}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {result.reviewerChecklist?.length > 0 && (
            <Section id="checklist" icon={ListChecks} title="Reviewer Checklist">
              <div className="space-y-2">
                {result.reviewerChecklist.map((item, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="mt-0.5 w-4 h-4 rounded border-white/20 bg-surface-700
                                 text-purple-500 focus:ring-purple-500/30 flex-shrink-0"
                    />
                    <span className="text-sm text-slate-300 group-hover:text-slate-200 transition-colors">
                      {item}
                    </span>
                  </label>
                ))}
              </div>
            </Section>
          )}

          {/* Full markdown preview */}
          {result.markdownFull && (
            <div className="glass-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                <span className="text-sm font-mono text-slate-400">Full Markdown</span>
                <div className="flex gap-2">
                  <CopyButton text={result.markdownFull} label="Copy Markdown" />
                  <button
                    onClick={() => downloadFile(result.markdownFull, 'pr-description.md')}
                    className="btn-ghost text-slate-400 text-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <pre
                className="p-4 text-xs font-mono text-slate-400 overflow-x-auto overflow-y-auto
                           leading-relaxed whitespace-pre bg-transparent"
                style={{ maxHeight: '300px' }}
              >
                {result.markdownFull}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
