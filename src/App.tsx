import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { HOME, Role, useAuth } from './lib/auth';
import { configured } from './lib/supabase';
import { Loading } from './components/ui';
import Login from './screens/auth/Login';
import SignUp from './screens/auth/SignUp';
import { BookingProvider } from './screens/family/booking';
import FamilyHome from './screens/family/Home';
import AddParent from './screens/family/AddParent';
import BookSetup from './screens/family/BookSetup';
import BookList from './screens/family/BookList';
import CaregiverProfile from './screens/family/CaregiverProfile';
import Checkout from './screens/family/Checkout';
import BookDone from './screens/family/BookDone';
import Timeline from './screens/family/Timeline';
import AlertDetail from './screens/family/AlertDetail';
import Renew from './screens/family/Renew';
import Services from './screens/family/Services';
import Account from './screens/family/Account';
import CaregiverToday from './screens/caregiver/Today';
import CheckIn from './screens/caregiver/CheckIn';
import VisitLog from './screens/caregiver/VisitLog';
import ElderHome from './screens/elder/Home';
import SosSent from './screens/elder/SosSent';
import AlertQueue from './screens/coordinator/Alerts';
import Assign from './screens/coordinator/Assign';
import Caregivers from './screens/coordinator/Caregivers';
import AddCaregiver from './screens/coordinator/AddCaregiver';
import Kpis from './screens/admin/Kpis';
import Escalations from './screens/admin/Escalations';
import Settings from './screens/admin/Settings';

function Guard({ role, children }: { role: Role | Role[]; children: JSX.Element }) {
  const { session, profile, ready } = useAuth();
  const loc = useLocation();
  if (!ready || (session && !profile)) return <div className="shell"><Loading /></div>;
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  const roles = Array.isArray(role) ? role : [role];
  if (!profile || !roles.includes(profile.role)) return <Navigate to={profile ? HOME[profile.role] : '/login'} replace />;
  return children;
}

function Start() {
  const { session, profile, ready } = useAuth();
  if (!ready || (session && !profile)) return <div className="shell"><Loading /></div>;
  return <Navigate to={session && profile ? HOME[profile.role] : '/login'} replace />;
}

export default function App() {
  if (!configured) {
    return <div className="shell"><div className="page"><p className="err">KinCare is not connected to its database. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the environment and redeploy.</p></div></div>;
  }
  const staff: Role[] = ['coordinator', 'admin'];
  return (
    <Routes>
      <Route path="/" element={<Start />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      <Route path="/f/*" element={<Guard role="family"><BookingProvider><Routes>
        <Route index element={<FamilyHome />} />
        <Route path="add-parent" element={<AddParent />} />
        <Route path="book" element={<BookSetup />} />
        <Route path="book/caregivers" element={<BookList />} />
        <Route path="book/caregiver/:id" element={<CaregiverProfile />} />
        <Route path="book/checkout" element={<Checkout />} />
        <Route path="book/done/:bookingId" element={<BookDone />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="timeline/:parentId" element={<Timeline />} />
        <Route path="alert/:id" element={<AlertDetail />} />
        <Route path="renew/:bookingId" element={<Renew />} />
        <Route path="services" element={<Services />} />
        <Route path="account" element={<Account />} />
      </Routes></BookingProvider></Guard>} />

      <Route path="/c/*" element={<Guard role="caregiver"><Routes>
        <Route index element={<CaregiverToday />} />
        <Route path="check-in/:shiftId" element={<CheckIn />} />
        <Route path="visit/:shiftId" element={<VisitLog />} />
      </Routes></Guard>} />

      <Route path="/e/*" element={<Guard role="elder"><Routes>
        <Route index element={<ElderHome />} />
        <Route path="sent" element={<SosSent />} />
      </Routes></Guard>} />

      <Route path="/k/*" element={<Guard role={staff}><Routes>
        <Route index element={<AlertQueue />} />
        <Route path="assign/:alertId" element={<Assign />} />
        <Route path="caregivers" element={<Caregivers />} />
        <Route path="caregivers/new" element={<AddCaregiver />} />
      </Routes></Guard>} />

      <Route path="/a/*" element={<Guard role="admin"><Routes>
        <Route index element={<Kpis />} />
        <Route path="escalations" element={<Escalations />} />
        <Route path="settings" element={<Settings />} />
      </Routes></Guard>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
