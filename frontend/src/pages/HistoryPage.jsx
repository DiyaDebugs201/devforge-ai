import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  History, GitBranch, TestTube2, FileText, Search,
  Trash2, Clock, ChevronLeft, ChevronRight, Terminal,
  BarChart2, Share2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../services/api';
import CopyButton from '../components/shared/CopyButton';
import ShareButton from '../components/shared/ShareButton';
import toast from 'react-hot-toast';

const TOOLS = [
  { key: 'branch', label: 'BranchNamer', icon: GitBranch, color: 'text-brand-400' },
  { key: 'tests', label: 'TestCraft', icon: TestTube2, color: 'text-blue-400' },
  { key: 'pr', label: 'PR Describer', icon: FileText, color: 'text-purple-400' },
];

const BranchItem = ({ item, onDelete }) => (
  <div className="glass-card p-4">
    <div className="flex items-start justify-between gap-4 mb-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-300 font-medium truncate">{item.input?.taskDescription}</p>
        {item.input?.ticketId && (
          <span className="badge badge-blue mt-1">{item.input.ticketId}</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <ShareButton tool="branch" historyId={item._id} isShared={item.isShared} />
        <button onClick={() => onDelete(item._id)} className="btn-ghost text-red-400 hover:text-red-300 text-xs">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
    <div className="space-y-1.5">
      {(item.branches || []).slice(0, 3).map((b, i) => (
        <div key={i} className="flex items-center gap-2 bg-surface-900/50 rounded-lg px-3 py-1.5">
          <Terminal className="w-3 h-3 text-slate-600 flex-shrink-0" />
          <code className="text-xs font-mono text-slate-400 flex-1 truncate">{b.name}</code>
          <CopyButton text={b.fullCommand} label="cmd" size="sm" />
        </div>
      ))}
    </div>
    <p className="text-xs text-slate-600 mt-3 flex items-center gap-1">
      <Clock className="w-3 h-3" />
      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
    </p>
  </div>
);

const TestItem = ({ item, onDelete }) => (
  <div className="glass-card p-4">
    <div className="flex items-start justify-between gap-4 mb-3">
      <div>
        <p className="text-sm font-mono text-slate-300">{item.input?.functionName}()</p>
        <span className="badge badge-blue mt-1">{item.input?.language}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <p className="text-xs text-slate-500">Coverage</p>
          <p className={`text-sm font-semibold ${item.output?.estimatedCoverage >= 80 ? 'text-brand-400' : 'text-orange-400'}`}>
            {item.output?.estimatedCoverage || 0}%
          </p>
        </div>
        <ShareButton tool="tests" historyId={item._id} isShared={item.isShared} />
        <button onClick={() => onDelete(item._id)} className="btn-ghost text-red-400 text-xs">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
    <div className="flex flex-wrap gap-1.5 mb-3">
      {(item.output?.testCases || []).reduce((acc, tc) => {
        if (!acc.find(x => x.category === tc.category)) acc.push(tc);
        return acc;
      }, []).map((tc) => (
        <span key={tc.category} className="badge badge-blue text-xs">{tc.category}</span>
      ))}
    </div>
    {item.output?.fullTestFile && (
      <CopyButton text={item.output.fullTestFile} label="Copy Test File" size="sm" />
    )}
    <p className="text-xs text-slate-600 mt-3 flex items-center gap-1">
      <Clock className="w-3 h-3" />
      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
    </p>
  </div>
);

const PRItem = ({ item, onDelete }) => (
  <div className="glass-card p-4">
    <div className="flex items-start justify-between gap-4 mb-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-200 truncate">{item.output?.title}</p>
        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.output?.summary}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`badge ${item.mode === 'detailed' ? 'badge-purple' : 'badge-blue'}`}>
          {item.mode}
        </span>
        <ShareButton tool="pr" historyId={item._id} isShared={item.isShared} />
        <button onClick={() => onDelete(item._id)} className="btn-ghost text-red-400 text-xs">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
    <div className="flex items-center gap-2 mt-3">
      <CopyButton text={item.output?.markdownFull || ''} label="Copy MD" size="sm" />
      <CopyButton text={item.output?.plainTextFull || ''} label="Copy Text" size="sm" />
    </div>
    <p className="text-xs text-slate-600 mt-3 flex items-center gap-1">
      <Clock className="w-3 h-3" />
      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
    </p>
  </div>
);

const ITEM_COMPONENTS = { branch: BranchItem, tests: TestItem, pr: PRItem };

export default function HistoryPage() {
  const { tool: toolParam } = useParams();
  const [activeTool, setActiveTool] = useState(toolParam || 'branch');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (search) params.append('search', search);
      const res = await api.get(`/history/${activeTool}?${params}`);
      setItems(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load history');
    } finally {
      setIsLoading(false);
    }
  }, [activeTool, page, search]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    setPage(1);
    setSearch('');
  }, [activeTool]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this history item?')) return;
    try {
      await api.delete(`/history/${activeTool}/${id}`);
      toast.success('Deleted');
      fetchHistory();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const ItemComponent = ITEM_COMPONENTS[activeTool];
  const toolMeta = TOOLS.find((t) => t.key === activeTool);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-surface-600 border border-white/10 rounded-lg">
          <History className="w-5 h-5 text-slate-400" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-white">History</h1>
          <p className="text-slate-400 text-sm">All your past AI generations, searchable and shareable</p>
        </div>
      </div>

      {/* Tool tabs */}
      <div className="flex gap-1 bg-surface-800 border border-white/5 rounded-xl p-1 mb-6 w-fit">
        {TOOLS.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setActiveTool(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTool === key
                ? 'bg-surface-600 text-slate-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon className={`w-4 h-4 ${activeTool === key ? color : ''}`} />
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={`Search ${toolMeta?.label} history...`}
          className="input-base pl-10"
        />
      </div>

      {/* Items */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <BarChart2 className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-medium mb-1">No history found</p>
          <p className="text-slate-600 text-sm">
            {search ? 'Try a different search term' : `Use ${toolMeta?.label} to generate your first result`}
          </p>
          {!search && (
            <Link to={`/${activeTool}`} className="btn-primary mt-4 inline-flex text-sm">
              Open {toolMeta?.label}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ItemComponent key={item._id} item={item} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {pagination.pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
