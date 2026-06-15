import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CopyButton({ text, label = 'Copy', className = '', size = 'sm' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const sizeClasses = size === 'sm'
    ? 'px-2.5 py-1.5 text-xs'
    : 'px-3 py-2 text-sm';

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 ${sizeClasses} rounded-lg font-medium
        transition-all duration-150 border
        ${copied
          ? 'bg-brand-500/15 border-brand-500/30 text-brand-400'
          : 'bg-surface-600 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 hover:bg-surface-500'
        } ${className}`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}
