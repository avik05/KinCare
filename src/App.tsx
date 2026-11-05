import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { HOME, Role, useAuth } from './lib/auth';
import { configured } from './lib/supabase';
import { AttentionProvider } from './components/layout';
import Login from './screens/auth/Login';
import SignUp from './screens/auth/SignUp';
import DemoReset from './screens/auth/DemoReset';
import Landing from './screens/landing/Landing';
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
import Account from './screens/family/Account';
import CaregiverToday from './screens/caregiver/Today';
import CheckIn from './screens/caregiver/CheckIn';
import VisitLog from './screens/caregiver/VisitLog';
import ElderHome from './screens/elder/Home';
import SosSent from './screens/elder/SosSent';
import AlertQueue from './screens/coordinator/Alerts';
import Caregivers from './screens/coordinator/Caregivers';
import AddCaregiver from './screens/coordinator/AddCaregiver';
import Kpis from './screens/admin/Kpis';
import Escalations from './screens/admin/Escalations';
import Settings from './screens/admin/Settings';

function Boot() {
  return <div className="boot" role="status" aria-label="Loading"><span className="spin" /></div>;
}

function Guard({ role, children }: { role: Role | Role[]; children: JSX.Element }) {
  const { session, profile, ready } = useAuth();
  const loc = useLocation();
  if (!ready || (session && !profile)) return <Boot />;
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  const roles = Array.isArray(role) ? role : [role];
  if (!profile || !roles.includes(profile.role)) return <Navigate to={profile ? HOME[profile.role] : '/login'} replace />;
  return children;
}

function Start() {
  const { session, profile, ready } = useAuth();
  if (!ready || (session && !profile)) return <Boot />;
  return session && profile ? <Navigate to={HOME[profile.role]} replace /> : <Landing />;
}

export default function App() {
  if (!configured) {
    return <div className="boot"><p className="err" style={{ maxWidth: 420 }}>KinCare is not connected to its database. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the environment and redeploy.</p></div>;
  }
  const staff: Role[] = ['coordinator', 'admin'];
  return (
    <AttentionProvider><Routes>
      <Route path="/" element={<Start />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/demo" element={<DemoReset />} />
      <Route path="/about" element={<Landing />} />

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
        <Route path="services" element={<Navigate to="/f/account" replace />} />
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
        <Route path="alert/:alertId" element={<AlertQueue />} />
        <Route path="assign/:alertId" element={<AlertQueue />} />
        <Route path="caregivers" element={<Caregivers />} />
        <Route path="caregivers/new" element={<AddCaregiver />} />
      </Routes></Guard>} />

      <Route path="/a/*" element={<Guard role="admin"><Routes>
        <Route index element={<Kpis />} />
        <Route path="escalations" element={<Escalations />} />
        <Route path="settings" element={<Settings />} />
      </Routes></Guard>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></AttentionProvider>
  );
}
