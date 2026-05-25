import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';
import { AuthProvider } from './AuthContext';
import { ErrorBoundary } from './ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
