import { useState } from 'react';
import { Share2, Check, Link, X } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import CopyButton from './CopyButton';

export default function ShareButton({ tool, historyId, isShared: initialShared = false }) {
  const [shareUrl, setShareUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPopover, setShowPopover] = useState(false);

  const handleShare = async () => {
    if (shareUrl) {
      setShowPopover(true);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(`/share/${tool}/${historyId}`);
      const url = res.data.shareUrl;
      setShareUrl(url);
      setShowPopover(true);
      toast.success('Share link created!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create share link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        disabled={loading}
        className="btn-ghost text-slate-400"
      >
        {loading ? (
          <div className="w-3.5 h-3.5 border border-slate-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Share2 className="w-3.5 h-3.5" />
        )}
        Share
      </button>

      {showPopover && shareUrl && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-surface-700 border border-white/10 rounded-xl shadow-2xl p-4 z-50 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <Link className="w-3.5 h-3.5 text-brand-400" />
              Public Share Link
            </div>
            <button onClick={() => setShowPopover(false)} className="text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-3 break-all font-mono bg-surface-900 rounded p-2">
            {shareUrl}
          </p>
          <CopyButton text={shareUrl} label="Copy Link" size="sm" className="w-full justify-center" />
          <p className="text-xs text-slate-600 mt-2 text-center">Link expires in 30 days</p>
        </div>
      )}
    </div>
  );
}
