import { HashRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ItemsList from './pages/Items/ItemsList';
import ItemForm from './pages/Items/ItemForm';
import ItemDetail from './pages/Items/ItemDetail';
import KitsList from './pages/Kits/KitsList';
import ReservationsList from './pages/Reservations/ReservationsList';
import ReservationForm from './pages/Reservations/ReservationForm';
import CheckoutsList from './pages/Checkouts/CheckoutsList';
import UserHistory from './pages/History/UserHistory';
import AdminPanel from './pages/Admin/AdminPanel';
import OrganizationsConsole from './pages/Organizations/OrganizationsConsole';
import ReportsPanel from './pages/Reports/ReportsPanel';
import ActivityLog from './pages/Activity/ActivityLog';
import MobileLayout from './pages/Mobile/MobileLayout';
import MyGear from './pages/Mobile/MyGear';
import Browse from './pages/Mobile/Browse';

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { borderRadius: '10px', fontSize: '14px' },
          }}
        />
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Mobile PWA — protected, own layout */}
          <Route
            path="/m/*"
            element={
              <ProtectedRoute>
                <MobileLayout>
                  <Routes>
                    <Route path="gear" element={<MyGear />} />
                    <Route path="browse" element={<Browse />} />
                    <Route path="*" element={<MyGear />} />
                  </Routes>
                </MobileLayout>
              </ProtectedRoute>
            }
          />

          {/* Protected — wrapped in Layout */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/items" element={<ItemsList />} />
                    <Route path="/items/new" element={<ItemForm />} />
                    <Route path="/items/:id" element={<ItemDetail />} />
                    <Route path="/items/:id/edit" element={<ItemForm />} />
                    <Route path="/kits" element={<KitsList />} />
                    <Route path="/reservations" element={<ReservationsList />} />
                    <Route path="/reservations/new" element={<ReservationForm />} />
                    <Route path="/checkouts" element={<CheckoutsList />} />
                    <Route path="/history" element={<UserHistory />} />
                    <Route path="/reports" element={<ReportsPanel />} />
                    <Route path="/activity" element={<ActivityLog />} />
                    <Route path="/admin" element={<AdminPanel />} />
                    <Route path="/organizations" element={<OrganizationsConsole />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
