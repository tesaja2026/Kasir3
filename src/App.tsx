import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import ErrorBoundary from './components/ErrorBoundary';
import OwnerLogin from './pages/OwnerLogin';
import OwnerApp from './pages/OwnerApp';
import CustomerLanding from './pages/CustomerLanding';
import CustomerCatalog from './pages/CustomerCatalog';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
        <Route path="/" element={<CustomerLanding />} />
        <Route path="/katalog" element={<CustomerCatalog />} />
        <Route path="/toko" element={<OwnerLogin />} />
        <Route path="/toko/*" element={<OwnerLogin />} />
        <Route path="/dashboard" element={<OwnerApp />} />
        <Route path="/dashboard/*" element={<OwnerApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster richColors position="top-center" />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
