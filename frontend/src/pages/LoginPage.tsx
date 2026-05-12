import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginPage as LegacyLoginPage } from '../app/components/LoginPage';

import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [auth.isAuthenticated, navigate]);

  return (
    <LegacyLoginPage
      onSuccess={() => {
        void auth.bootstrap();
        navigate('/dashboard', { replace: true });
      }}
    />
  );
}