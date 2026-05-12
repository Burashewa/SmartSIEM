import { useAuth } from '../hooks/useAuth';

export default function AccessControlPage() {
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toLowerCase() === 'admin' || (user?.role || '').toLowerCase() === 'administrator';

  if (!isAdmin) {
    return (
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-8 text-center">
        <h2 className="text-xl text-white">Access Control</h2>
        <p className="text-sm text-gray-400 mt-2">This page is restricted to administrators.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f0f17] border border-[#1f1f2e] p-8">
      <h2 className="text-xl text-white">Access Control</h2>
      <p className="text-sm text-gray-400 mt-2">
        Role and permission administration is available for admin users.
      </p>
    </div>
  );
}
