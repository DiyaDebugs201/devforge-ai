import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GitBranch, TestTube2, FileText, Zap, ArrowRight,
  BarChart2, Clock, TrendingUp, Activity
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../services/api';
import useAuthStore from '../store/authStore';

const TOOL_META = {
  branch: {
    label: 'BranchNamer',
    icon: GitBranch,
    color: 'text-brand-400',
    bg: 'bg-brand-500/10',
    border: 'border-brand-500/20',
    path: '/branch',
    desc: 'Generate semantic git branch names',
  },
  tests: {
    label: 'TestCraft',
    icon: TestTube2,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    path: '/tests',
    desc: 'Generate Jest test suites from functions',
  },
  pr: {
    label: 'PR Describer',
    icon: FileText,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    path: '/pr',
    desc: 'Generate PR descriptions from diffs',
  },
};

const getActivityTitle = (item) => {
  if (item.tool === 'branch') return item.input?.taskDescription || 'Branch generation';
  if (item.tool === 'tests') return `${item.input?.functionName || 'function'}() — test suite`;
  if (item.tool === 'pr') return item.output?.title || 'PR description';
  return 'Generation';
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [dashData, setDashData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/history/dashboard');
        setDashData(res.data.data);
      } catch {
        // Fail silently — dashboard is non-critical
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const dailyUsed = dashData?.dailyUsage?.count ?? user?.dailyUsage?.count ?? 0;
  const dailyLimit = dashData?.dailyLimit ?? 20;
  const dailyPct = Math.min(100, (dailyUsed / dailyLimit) * 100);

  const stats = dashData?.usageStats ?? user?.usageStats ?? {};
  const totalGenerated = (stats.branch || 0) + (stats.tests || 0) + (stats.pr || 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-white mb-1">
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-400">Here's your DevForge AI activity overview</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total generations */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-brand-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Total Generated</span>
          </div>
          <p className="text-3xl font-display font-bold text-white">{totalGenerated}</p>
          <p className="text-xs text-slate-500 mt-1">all time</p>
        </div>

        {/* Daily usage */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Today's Usage</span>
          </div>
          <p className="text-3xl font-display font-bold text-white">
            {dailyUsed}
            <span className="text-lg text-slate-500">/{dailyLimit}</span>
          </p>
          <div className="mt-2 w-full h-1 bg-surface-600 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                dailyPct >= 90 ? 'bg-red-500' : dailyPct >= 70 ? 'bg-orange-500' : 'bg-blue-500'
              }`}
              style={{ width: `${dailyPct}%` }}
            />
          </div>
        </div>

        {/* Per-tool breakdown */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4 text-brand-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Branches</span>
          </div>
          <p className="text-3xl font-display font-bold text-white">{stats.branch || 0}</p>
          <p className="text-xs text-slate-500 mt-1">generated</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TestTube2 className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Test Suites</span>
          </div>
          <p className="text-3xl font-display font-bold text-white">{stats.tests || 0}</p>
          <p className="text-xs text-slate-500 mt-1">generated</p>
        </div>
      </div>

      {/* Tool cards */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Tools</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {Object.entries(TOOL_META).map(([key, tool]) => {
            const Icon = tool.icon;
            const usageCount = stats[key] || 0;
            return (
              <Link
                key={key}
                to={tool.path}
                className="glass-card-hover p-5 group flex flex-col gap-4"
              >
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 ${tool.bg} border ${tool.border} rounded-xl`}>
                    <Icon className={`w-5 h-5 ${tool.color}`} />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-200 mb-1">{tool.label}</h3>
                  <p className="text-xs text-slate-500">{tool.desc}</p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <BarChart2 className={`w-3.5 h-3.5 ${tool.color}`} />
                  <span className="text-xs text-slate-500">{usageCount} generations</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Recent Activity</h2>
          <Link to="/history" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
            View all →
          </Link>
        </div>

        {isLoading ? (
          <div className="glass-card p-8 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : dashData?.recentActivity?.length > 0 ? (
          <div className="space-y-2">
            {dashData.recentActivity.map((item, i) => {
              const meta = TOOL_META[item.tool];
              const Icon = meta?.icon || Zap;
              return (
                <div
                  key={item._id || i}
                  className="glass-card px-4 py-3 flex items-center gap-4 animate-slide-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className={`p-1.5 ${meta?.bg} rounded-lg flex-shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${meta?.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 truncate">{getActivityTitle(item)}</p>
                    <p className="text-xs text-slate-600">{meta?.label}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-card p-10 text-center">
            <Zap className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No activity yet. Start generating!</p>
            <Link to="/branch" className="btn-primary mt-4 inline-flex text-sm">
              Try BranchNamer <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
