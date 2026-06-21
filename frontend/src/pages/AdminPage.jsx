import { useState, useEffect } from 'react';
import {
  Shield, Users, Activity, GitBranch, TestTube2, FileText,
  Link2, TrendingUp, RefreshCw, CheckCircle, XCircle, Crown
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stats');

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
      ]);
      setStats(statsRes.data.data);
      setUsers(usersRes.data.data);
    } catch {
      toast.error('Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      toast.success('Role updated');
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleToggleActive = async (userId) => {
    try {
      const res = await api.put(`/admin/users/${userId}/toggle`);
      toast.success(res.data.message);
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle user');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <Shield className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Admin Console</h1>
            <p className="text-slate-400 text-sm">Platform usage statistics and user management</p>
          </div>
        </div>
        <button onClick={fetchStats} className="btn-secondary text-sm">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">Total Users</span>
            </div>
            <p className="text-3xl font-display font-bold text-white">{stats.summary.totalUsers}</p>
            <p className="text-xs text-brand-400 mt-1">{stats.summary.activeUsersToday} active today</p>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-brand-400" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">Total Generations</span>
            </div>
            <p className="text-3xl font-display font-bold text-white">{stats.summary.totalGenerations}</p>
            <p className="text-xs text-slate-500 mt-1">all tools, all time</p>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">By Tool</span>
            </div>
            <div className="space-y-1 mt-1">
              <div className="flex justify-between text-xs">
                <span className="text-brand-400 flex items-center gap-1"><GitBranch className="w-3 h-3" /> Branch</span>
                <span className="text-slate-300">{stats.byTool.branch}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-blue-400 flex items-center gap-1"><TestTube2 className="w-3 h-3" /> Tests</span>
                <span className="text-slate-300">{stats.byTool.tests}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-purple-400 flex items-center gap-1"><FileText className="w-3 h-3" /> PR</span>
                <span className="text-slate-300">{stats.byTool.pr}</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">Active Links</span>
            </div>
            <p className="text-3xl font-display font-bold text-white">{stats.summary.totalSharedLinks}</p>
            <p className="text-xs text-slate-500 mt-1">shared results</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-800 border border-white/5 rounded-xl p-1 mb-6 w-fit">
        {[
          { key: 'stats', label: 'Top Users' },
          { key: 'users', label: 'All Users' },
          { key: 'recent', label: 'Recent Signups' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key ? 'bg-surface-600 text-slate-200' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* User tables */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Branch</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tests</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">PR</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(activeTab === 'top' ? stats?.topUsers : activeTab === 'recent' ? stats?.recentUsers : users)?.map((u) => {
                const total = (u.usageStats?.branch || 0) + (u.usageStats?.tests || 0) + (u.usageStats?.pr || 0);
                return (
                  <tr key={u._id} className="hover:bg-white/2 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 text-xs font-semibold flex-shrink-0">
                          {u.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-200 truncate">{u.name}</p>
                          <p className="text-xs text-slate-500 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'admin'
                        ? <span className="badge badge-orange"><Crown className="w-2.5 h-2.5" /> admin</span>
                        : <span className="badge badge-blue">user</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400 text-xs">{u.usageStats?.branch || 0}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400 text-xs">{u.usageStats?.tests || 0}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400 text-xs">{u.usageStats?.pr || 0}</td>
                    <td className="px-4 py-3 text-right font-mono text-brand-400 text-xs font-semibold">{total}</td>
                    <td className="px-4 py-3 text-center">
                      {u.isActive !== false
                        ? <CheckCircle className="w-4 h-4 text-brand-400 inline" />
                        : <XCircle className="w-4 h-4 text-red-400 inline" />
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handleRoleChange(u._id, u.role === 'admin' ? 'user' : 'admin')}
                          className="btn-ghost text-xs text-slate-500"
                        >
                          {u.role === 'admin' ? 'Demote' : 'Promote'}
                        </button>
                        <button
                          onClick={() => handleToggleActive(u._id)}
                          className={`btn-ghost text-xs ${u.isActive !== false ? 'text-red-400' : 'text-brand-400'}`}
                        >
                          {u.isActive !== false ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
