import { useState } from 'react';
import {
  GitBranch, Ticket, Settings, ChevronDown, ChevronUp,
  Terminal, Check, Wand2, AlertCircle
} from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import CopyButton from '../components/shared/CopyButton';
import ShareButton from '../components/shared/ShareButton';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

const PREFIX_COLORS = {
  'feature': 'badge-green',
  'fix': 'badge-orange',
  'hotfix': 'badge-red',
  'chore': 'badge-blue',
  'refactor': 'badge-purple',
};

export default function BranchNamerPage() {
  const { user } = useAuthStore();
  const [taskDescription, setTaskDescription] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [historyId, setHistoryId] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState(user?.branchConfig || {
    prefixes: ['feature', 'fix', 'chore', 'hotfix', 'refactor'],
    ticketPrefix: '',
    separator: '-',
    maxLength: 60,
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!taskDescription.trim()) {
      toast.error('Please enter a task description');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const res = await api.post('/branch/generate', {
        taskDescription: taskDescription.trim(),
        ticketId: ticketId.trim() || undefined,
      });

      setResult(res.data.data.branches);
      setHistoryId(res.data.data.historyId);
      toast.success('Branch names generated!');
    } catch (err) {
      const message = err.response?.data?.message || 'Generation failed. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCommand = (command, index) => {
    navigator.clipboard.writeText(command);
    setCopiedIndex(index);
    toast.success('Command copied!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await api.put('/auth/branch-config', config);
      toast.success('Branch config saved!');
      setShowConfig(false);
    } catch {
      toast.error('Failed to save config');
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-500/10 border border-brand-500/20 rounded-lg">
              <GitBranch className="w-5 h-5 text-brand-400" />
            </div>
            <h1 className="text-2xl font-display font-bold text-white">BranchNamer</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Generate semantic Git branch names from task descriptions or ticket titles
          </p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="btn-ghost text-slate-400 text-xs"
        >
          <Settings className="w-4 h-4" />
          Config
          {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Config panel */}
      {showConfig && (
        <div className="glass-card p-5 mb-6 animate-slide-up">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Team Branch Naming Config</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-base">Max Length</label>
              <input
                type="number"
                value={config.maxLength}
                onChange={(e) => setConfig({ ...config, maxLength: parseInt(e.target.value) })}
                min={30} max={100}
                className="input-base"
              />
            </div>
            <div>
              <label className="label-base">Separator</label>
              <select
                value={config.separator}
                onChange={(e) => setConfig({ ...config, separator: e.target.value })}
                className="input-base"
              >
                <option value="-">Hyphen (-)</option>
                <option value="_">Underscore (_)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label-base">Default Ticket Prefix</label>
              <input
                placeholder="e.g. PROJ"
                value={config.ticketPrefix}
                onChange={(e) => setConfig({ ...config, ticketPrefix: e.target.value })}
                className="input-base"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowConfig(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleSaveConfig} disabled={savingConfig} className="btn-primary text-sm">
              {savingConfig ? 'Saving...' : 'Save Config'}
            </button>
          </div>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleGenerate} className="glass-card p-6 mb-6">
        <div className="mb-4">
          <label className="label-base">
            Task Description or Ticket Title <span className="text-red-400">*</span>
          </label>
          <textarea
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="e.g. Fix login bug where users with special characters in password can't authenticate"
            rows={3}
            maxLength={500}
            className="input-base resize-none"
          />
          <div className="flex justify-between mt-1">
            <p className="text-xs text-slate-600">Be descriptive for better branch names</p>
            <span className="text-xs text-slate-600">{taskDescription.length}/500</span>
          </div>
        </div>

        <div className="mb-5">
          <label className="label-base">
            <Ticket className="inline w-3.5 h-3.5 mb-0.5 mr-1" />
            Ticket ID <span className="text-slate-600">(optional)</span>
          </label>
          <input
            type="text"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value.toUpperCase())}
            placeholder="PROJ-123"
            className="input-base"
            pattern="^[A-Z0-9]+-\d+$|^$"
          />
          <p className="text-xs text-slate-600 mt-1">Format: PROJ-123</p>
        </div>

        <button type="submit" disabled={isLoading || !taskDescription.trim()} className="btn-primary w-full justify-center">
          <Wand2 className="w-4 h-4" />
          {isLoading ? 'Generating...' : 'Generate Branch Names'}
        </button>
      </form>

      {/* Loading */}
      {isLoading && (
        <LoadingSpinner text="Naming your branch..." subtext="AI is analyzing your task description" />
      )}

      {/* Results */}
      {result && !isLoading && (
        <div className="animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Generated Options</h2>
            {historyId && (
              <ShareButton tool="branch" historyId={historyId} />
            )}
          </div>

          <div className="space-y-3">
            {result.map((branch, index) => (
              <div
                key={index}
                className="glass-card-hover p-4 animate-slide-up"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`badge ${PREFIX_COLORS[branch.prefix] || 'badge-blue'}`}>
                        {branch.prefix}
                      </span>
                      {branch.valid ? (
                        <span className="badge-green badge"><Check className="w-2.5 h-2.5" /> Valid</span>
                      ) : (
                        <span className="badge-red badge"><AlertCircle className="w-2.5 h-2.5" /> Issues</span>
                      )}
                    </div>
                    <p className="font-mono text-sm text-slate-200 break-all">{branch.name}</p>
                    {branch.validationErrors?.length > 0 && (
                      <p className="text-xs text-red-400 mt-1">{branch.validationErrors.join(', ')}</p>
                    )}
                  </div>
                  <CopyButton text={branch.name} label="Branch" size="sm" />
                </div>

                {/* Git command */}
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Terminal className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <code className="text-xs font-mono text-slate-400 truncate">
                        {branch.fullCommand}
                      </code>
                    </div>
                    <button
                      onClick={() => handleCopyCommand(branch.fullCommand, index)}
                      className={`flex-shrink-0 text-xs px-2 py-1 rounded-md border transition-all ${
                        copiedIndex === index
                          ? 'border-brand-500/30 text-brand-400 bg-brand-500/10'
                          : 'border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20'
                      }`}
                    >
                      {copiedIndex === index ? <Check className="w-3 h-3" /> : 'Copy cmd'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
