import { useState, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  TestTube2, Wand2, ChevronDown, ChevronUp,
  BarChart2, FileCode, Download, RefreshCw
} from 'lucide-react';
import api from '../services/api';
import CopyButton from '../components/shared/CopyButton';
import ShareButton from '../components/shared/ShareButton';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

// ── category styling ──────────────────────────────────────────────────────
const CATEGORY_META = {
  'happy-path': { label: 'Happy Path',        badge: 'badge-green',  icon: '✅' },
  'edge-case':  { label: 'Edge Case',         badge: 'badge-orange', icon: '⚠️' },
  'error':      { label: 'Error / Throws',    badge: 'badge-red',    icon: '❌' },
  'boundary':   { label: 'Boundary',          badge: 'badge-blue',   icon: '🔲' },
};

// ── starter placeholder ───────────────────────────────────────────────────
const PLACEHOLDER = `// Paste your JavaScript or TypeScript function here.
// Example:

/**
 * Calculates a discounted price.
 * @param {number} price - Original price (must be >= 0)
 * @param {number} discountPercent - 0-100
 * @returns {number} Discounted price
 */
function calculateDiscount(price, discountPercent) {
  if (typeof price !== 'number' || typeof discountPercent !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  if (discountPercent < 0 || discountPercent > 100) {
    throw new RangeError('Discount must be between 0 and 100');
  }
  if (price < 0) {
    throw new RangeError('Price must be non-negative');
  }
  return parseFloat((price * (1 - discountPercent / 100)).toFixed(2));
}

module.exports = { calculateDiscount };`;

// ── download helper ───────────────────────────────────────────────────────
function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── coverage bar colour ───────────────────────────────────────────────────
const coverageColor = (pct) =>
  pct >= 80 ? 'text-brand-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400';
const coverageBg = (pct) =>
  pct >= 80 ? 'bg-brand-500'  : pct >= 60 ? 'bg-yellow-500'  : 'bg-red-500';

// ═════════════════════════════════════════════════════════════════════════
export default function TestCraftPage() {
  const [code,          setCode]          = useState(PLACEHOLDER);
  const [language,      setLanguage]      = useState('javascript');
  const [isLoading,     setIsLoading]     = useState(false);
  const [result,        setResult]        = useState(null);
  const [historyId,     setHistoryId]     = useState(null);
  const [activeTab,     setActiveTab]     = useState('full');   // 'full' | 'cases'
  const [expandedCase,  setExpandedCase]  = useState(null);
  const editorRef = useRef(null);

  // ── generate ────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    const trimmed = (editorRef.current?.getValue() ?? code).trim();
    if (trimmed.length < 10) {
      toast.error('Please paste a function before generating tests.');
      return;
    }

    setIsLoading(true);
    setResult(null);
    setExpandedCase(null);

    try {
      const res = await api.post('/tests/generate', {
        functionCode: trimmed,
        language,
      });

      const data = res.data.data;

      // ── normalise fullTestFile ───────────────────────────────────
      // The server already handles this, but double-check client-side.
      let fullTestFile = data.fullTestFile || '';
      if (typeof fullTestFile === 'object') {
        fullTestFile = JSON.stringify(fullTestFile, null, 2);
      }
      // Replace any remaining literal \n sequences with real newlines
      fullTestFile = fullTestFile
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .trim();

      setResult({ ...data, fullTestFile });
      setHistoryId(data.historyId);
      setActiveTab('full');
      toast.success('Test suite generated!');
    } catch (err) {
      const msg = err.response?.data?.message || 'Generation failed. Please try again.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [code, language]);

  // ── reset editor ────────────────────────────────────────────────────────
  const handleReset = () => {
    editorRef.current?.setValue(PLACEHOLDER);
    setCode(PLACEHOLDER);
    setResult(null);
    setHistoryId(null);
  };

  // ── category breakdown from testCases ────────────────────────────────────
  const categoryBreakdown = result?.testCases
    ? Object.entries(
        result.testCases.reduce((acc, tc) => {
          acc[tc.category] = (acc[tc.category] || 0) + 1;
          return acc;
        }, {})
      )
    : [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <TestTube2 className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white">TestCraft</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Paste a function → get a complete Jest test suite with happy path, edge cases, and error handling.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Language selector */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="text-sm bg-surface-700 border border-white/10 text-slate-300 rounded-lg
                       px-3 py-1.5 focus:outline-none focus:border-blue-500/40"
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
          </select>

          {/* Reset */}
          <button onClick={handleReset} className="btn-ghost text-slate-500 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* ── Monaco Editor ───────────────────────────────────────────── */}
      <div className="glass-card mb-4 overflow-hidden">
        {/* Editor title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-mono text-slate-400">
              {language === 'javascript' ? 'function.js' : 'function.ts'}
            </span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60"    />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-brand-500/60"  />
          </div>
        </div>

        <div className="monaco-editor-container" style={{ height: '300px' }}>
          <Editor
            height="300px"
            language={language}
            defaultValue={PLACEHOLDER}
            theme="vs-dark"
            onMount={(editor) => { editorRef.current = editor; }}
            onChange={(val) => setCode(val || '')}
            options={{
              fontSize:              13,
              fontFamily:            '"JetBrains Mono", "Fira Code", Consolas, monospace',
              fontLigatures:         true,
              minimap:               { enabled: false },
              scrollBeyondLastLine:  false,
              lineNumbers:           'on',
              padding:               { top: 12, bottom: 12 },
              wordWrap:              'on',
              automaticLayout:       true,
              tabSize:               2,
              renderWhitespace:      'boundary',
              bracketPairColorization: { enabled: true },
            }}
          />
        </div>
      </div>

      {/* ── Generate button ──────────────────────────────────────────── */}
      <button
        onClick={handleGenerate}
        disabled={isLoading}
        className="btn-primary w-full justify-center mb-8 py-3 bg-blue-600 hover:bg-blue-500
                   focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading
          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating Tests...</>
          : <><Wand2 className="w-4 h-4" /> Generate Jest Test Suite</>
        }
      </button>

      {/* ── Loading ──────────────────────────────────────────────────── */}
      {isLoading && (
        <LoadingSpinner
          text="Crafting your test suite…"
          subtext="Analyzing function signature, edge cases, and error paths"
        />
      )}

      {/* ── Results ──────────────────────────────────────────────────── */}
      {result && !isLoading && (
        <div className="animate-slide-up space-y-5">

          {/* Stats bar */}
          <div className="glass-card p-4">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-xs text-slate-500 mb-1">Function</p>
                <p className="font-mono text-sm text-slate-200">{result.functionName}()</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Test Cases</p>
                <p className="font-mono text-sm text-slate-200">
                  {result.testCases?.length ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Est. Coverage</p>
                <div className="flex items-center gap-2">
                  <p className={`font-mono text-sm font-semibold ${coverageColor(result.estimatedCoverage)}`}>
                    {result.estimatedCoverage}%
                  </p>
                  <div className="w-16 h-1.5 bg-surface-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${coverageBg(result.estimatedCoverage)}`}
                      style={{ width: `${result.estimatedCoverage}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500 mb-1">Import</p>
                <code className="text-xs font-mono text-slate-400 truncate block">
                  {result.importStatement}
                </code>
              </div>
              {historyId && (
                <div className="ml-auto flex-shrink-0">
                  <ShareButton tool="tests" historyId={historyId} />
                </div>
              )}
            </div>
          </div>

          {/* Category badges */}
          {categoryBreakdown.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {categoryBreakdown.map(([cat, count]) => {
                const meta = CATEGORY_META[cat] || { label: cat, badge: 'badge-blue', icon: '🔵' };
                return (
                  <span key={cat} className={`badge ${meta.badge}`}>
                    {meta.icon} {meta.label} ({count})
                  </span>
                );
              })}
            </div>
          )}

          {/* Tab switcher */}
          <div className="flex gap-1 bg-surface-800 border border-white/5 rounded-lg p-1 w-fit">
            {[
              { id: 'full',  label: 'Full Test File' },
              { id: 'cases', label: `Individual Cases (${result.testCases?.length ?? 0})` },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === id
                    ? 'bg-surface-600 text-slate-200'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── FULL TEST FILE TAB ─────────────────────────────────── */}
          {activeTab === 'full' && (
            <div className="glass-card overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-mono text-slate-400">
                    {result.functionName}.test.{language === 'typescript' ? 'ts' : 'js'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CopyButton text={result.fullTestFile} label="Copy File" />
                  <button
                    onClick={() =>
                      downloadFile(
                        result.fullTestFile,
                        `${result.functionName}.test.${language === 'typescript' ? 'ts' : 'js'}`
                      )
                    }
                    className="btn-ghost text-slate-400 text-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
              </div>

              {/* File content — rendered as real multi-line code */}
              {result.fullTestFile ? (
                <div className="relative">
                  <pre
                    className="p-5 text-xs font-mono text-slate-300 overflow-x-auto overflow-y-auto
                               leading-relaxed whitespace-pre bg-transparent"
                    style={{ maxHeight: '600px', minHeight: '120px' }}
                  >
                    <code>{result.fullTestFile}</code>
                  </pre>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500">
                  <p className="text-sm">No test file content was generated.</p>
                  <p className="text-xs mt-1">Try regenerating or switch to Individual Cases tab.</p>
                </div>
              )}
            </div>
          )}

          {/* ── INDIVIDUAL CASES TAB ──────────────────────────────── */}
          {activeTab === 'cases' && (
            <div className="space-y-3">
              {(!result.testCases || result.testCases.length === 0) ? (
                <div className="glass-card p-8 text-center text-slate-500">
                  <BarChart2 className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                  <p className="text-sm">No individual test cases were parsed.</p>
                  <p className="text-xs mt-1">Switch to the Full File tab to see the generated tests.</p>
                </div>
              ) : (
                result.testCases.map((tc, index) => {
                  const meta = CATEGORY_META[tc.category] || {
                    label: tc.category, badge: 'badge-blue', icon: '🔵',
                  };
                  const isExpanded = expandedCase === index;

                  return (
                    <div
                      key={index}
                      className="glass-card overflow-hidden animate-slide-up"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <button
                        onClick={() => setExpandedCase(isExpanded ? null : index)}
                        className="w-full flex items-center justify-between px-4 py-3
                                   hover:bg-white/[0.02] transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`badge ${meta.badge} flex-shrink-0`}>
                            {meta.icon} {meta.label}
                          </span>
                          <span className="text-sm text-slate-300 truncate">{tc.name}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          {tc.code && (
                            <CopyButton text={tc.code} label="Copy" size="sm" />
                          )}
                          {isExpanded
                            ? <ChevronUp   className="w-4 h-4 text-slate-500" />
                            : <ChevronDown className="w-4 h-4 text-slate-500" />
                          }
                        </div>
                      </button>

                      {isExpanded && tc.code && (
                        <div className="border-t border-white/5">
                          <pre
                            className="p-4 text-xs font-mono text-slate-300 overflow-x-auto
                                       bg-surface-900/50 leading-relaxed whitespace-pre"
                          >
                            <code>{tc.code}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
