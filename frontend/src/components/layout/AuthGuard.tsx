import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store';

interface Props {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export default function AuthGuard({ children, requiredRoles }: Props) {
  const { isAuthenticated, user } = useStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRoles && user && !requiredRoles.includes(user.role) && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-sm text-gray-400">
            You don't have permission to access this area.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
