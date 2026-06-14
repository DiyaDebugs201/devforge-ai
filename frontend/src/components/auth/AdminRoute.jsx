import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

export default function AdminRoute() {
  const { user } = useAuthStore();

  if (!user) return <Navigate to="/dashboard" replace />;
  if (user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-6xl">🔒</div>
        <h2 className="text-xl font-semibold text-slate-300">Admin Access Required</h2>
        <p className="text-slate-500">You don't have permission to view this page.</p>
      </div>
    );
  }

  return <Outlet />;
}
