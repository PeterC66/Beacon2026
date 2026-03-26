// beacon2/frontend/src/App.jsx

import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { getPreferences } from './hooks/usePreferences.js';
import CookieConsent   from './components/CookieConsent.jsx';
import HelpWidget from './components/HelpWidget.jsx';
import Login           from './pages/Login.jsx';
import Home            from './pages/Home.jsx';
import RoleList        from './pages/roles/RoleList.jsx';
import RoleEditor      from './pages/roles/RoleEditor.jsx';
import UserList        from './pages/users/UserList.jsx';
import UserEditor      from './pages/users/UserEditor.jsx';
import SystemLogin       from './pages/system/SystemLogin.jsx';
import SystemDashboard   from './pages/system/SystemDashboard.jsx';
import MemberClassList   from './pages/membership/MemberClassList.jsx';
import MemberClassEditor from './pages/membership/MemberClassEditor.jsx';
import MemberStatusList  from './pages/membership/MemberStatusList.jsx';
import MemberList        from './pages/members/MemberList.jsx';
import MemberEditor      from './pages/members/MemberEditor.jsx';
import MemberCompactView from './pages/members/MemberCompactView.jsx';
import AddressesExport   from './pages/members/AddressesExport.jsx';
import GroupList         from './pages/groups/GroupList.jsx';
import GroupRecord       from './pages/groups/GroupRecord.jsx';
import FacultyList       from './pages/groups/FacultyList.jsx';
import VenueList         from './pages/groups/VenueList.jsx';
import VenueEditor       from './pages/groups/VenueEditor.jsx';
import SystemSettings    from './pages/settings/SystemSettings.jsx';
import FinanceAccounts    from './pages/finance/FinanceAccounts.jsx';
import FinanceCategories  from './pages/finance/FinanceCategories.jsx';
import FinanceLedger      from './pages/finance/FinanceLedger.jsx';
import TransactionEditor  from './pages/finance/TransactionEditor.jsx';
import TransactionRefund  from './pages/finance/TransactionRefund.jsx';
import ConfigureAccount       from './pages/finance/ConfigureAccount.jsx';
import PaymentMethodDefaults from './pages/finance/PaymentMethodDefaults.jsx';
import TransferMoney      from './pages/finance/TransferMoney.jsx';
import ReconcileAccount   from './pages/finance/ReconcileAccount.jsx';
import FinancialStatement from './pages/finance/FinancialStatement.jsx';
import GroupsStatement    from './pages/finance/GroupsStatement.jsx';
import GiftAidDeclaration from './pages/finance/GiftAidDeclaration.jsx';
import CreditBatches      from './pages/finance/CreditBatches.jsx';
import MemberValidator    from './pages/admin/MemberValidator.jsx';
import Utilities          from './pages/admin/Utilities.jsx';
import PollList           from './pages/admin/PollList.jsx';
import AuditLog           from './pages/misc/AuditLog.jsx';
import AuditRecord        from './pages/misc/AuditRecord.jsx';
import GiftAidLog         from './pages/misc/GiftAidLog.jsx';
import OfficerList        from './pages/misc/OfficerList.jsx';
import DataBackup         from './pages/misc/DataBackup.jsx';
import PersonalPreferences from './pages/settings/PersonalPreferences.jsx';
import RecentMembers      from './pages/members/RecentMembers.jsx';
import MemberStatistics   from './pages/members/MemberStatistics.jsx';
import MembershipRenewals from './pages/membership/MembershipRenewals.jsx';
import NonRenewals        from './pages/membership/NonRenewals.jsx';
import MembershipCards    from './pages/membership/MembershipCards.jsx';
import EmailCompose        from './pages/email/EmailCompose.jsx';
import EmailDelivery       from './pages/email/EmailDelivery.jsx';
import EmailDeliveryDetail from './pages/email/EmailDeliveryDetail.jsx';
import EmailUnblocker      from './pages/email/EmailUnblocker.jsx';
import SystemMessages      from './pages/settings/SystemMessages.jsx';
import PublicLinks         from './pages/misc/PublicLinks.jsx';
import Calendar            from './pages/groups/Calendar.jsx';
import OpenMeetings        from './pages/groups/OpenMeetings.jsx';
import LetterCompose       from './pages/letters/LetterCompose.jsx';
import JoinForm            from './pages/public/JoinForm.jsx';
import JoinComplete        from './pages/public/JoinComplete.jsx';
import PortalLogin         from './pages/public/PortalLogin.jsx';
import PortalRegister      from './pages/public/PortalRegister.jsx';
import PortalVerifyEmail   from './pages/public/PortalVerifyEmail.jsx';
import PortalForgotPassword from './pages/public/PortalForgotPassword.jsx';
import PortalResetPassword  from './pages/public/PortalResetPassword.jsx';
import ChangePassword       from './pages/ChangePassword.jsx';
import CustomFields         from './pages/settings/CustomFields.jsx';

function ProtectedRoute({ children }) {
  const { isLoggedIn, mustChangePassword } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (mustChangePassword) return <Navigate to="/change-password" replace />;
  return children;
}

function AuthRequired({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function RootLayout() {
  return (
    <>
      <Outlet />
      <HelpWidget />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <Login /> },

      // System admin routes (auth handled inside pages via sessionStorage)
      { path: '/system/login', element: <SystemLogin /> },
      { path: '/system',       element: <SystemDashboard /> },

      // Force-change-password (requires login but not subject to mustChangePassword redirect)
      { path: '/change-password', element: <AuthRequired><ChangePassword /></AuthRequired> },

      // Protected tenant routes
      { path: '/',           element: <ProtectedRoute><Home /></ProtectedRoute> },
      { path: '/roles',      element: <ProtectedRoute><RoleList /></ProtectedRoute> },
      { path: '/roles/new',  element: <ProtectedRoute><RoleEditor /></ProtectedRoute> },
      { path: '/roles/:id',  element: <ProtectedRoute><RoleEditor /></ProtectedRoute> },
      { path: '/users',      element: <ProtectedRoute><UserList /></ProtectedRoute> },
      { path: '/users/new',  element: <ProtectedRoute><UserEditor /></ProtectedRoute> },
      { path: '/users/:id',  element: <ProtectedRoute><UserEditor /></ProtectedRoute> },
      { path: '/membership/renewals',     element: <ProtectedRoute><MembershipRenewals /></ProtectedRoute> },
      { path: '/membership/non-renewals', element: <ProtectedRoute><NonRenewals /></ProtectedRoute> },
      { path: '/membership/classes',      element: <ProtectedRoute><MemberClassList /></ProtectedRoute> },
      { path: '/membership/classes/new',  element: <ProtectedRoute><MemberClassEditor /></ProtectedRoute> },
      { path: '/membership/classes/:id',  element: <ProtectedRoute><MemberClassEditor /></ProtectedRoute> },
      { path: '/membership/statuses',     element: <ProtectedRoute><MemberStatusList /></ProtectedRoute> },
      { path: '/membership/cards',       element: <ProtectedRoute><MembershipCards /></ProtectedRoute> },
      { path: '/members',             element: <ProtectedRoute><MemberList /></ProtectedRoute> },
      { path: '/members/new',         element: <ProtectedRoute><MemberEditor /></ProtectedRoute> },
      { path: '/members/recent',       element: <ProtectedRoute><RecentMembers /></ProtectedRoute> },
      { path: '/members/statistics',   element: <ProtectedRoute><MemberStatistics /></ProtectedRoute> },
      { path: '/members/:id',         element: <ProtectedRoute><MemberEditor /></ProtectedRoute> },
      { path: '/members/:id/compact', element: <ProtectedRoute><MemberCompactView /></ProtectedRoute> },
      { path: '/addresses-export',    element: <ProtectedRoute><AddressesExport /></ProtectedRoute> },
      { path: '/groups',       element: <ProtectedRoute><GroupList /></ProtectedRoute> },
      { path: '/groups/new',   element: <ProtectedRoute><GroupRecord /></ProtectedRoute> },
      { path: '/groups/:id',   element: <ProtectedRoute><GroupRecord /></ProtectedRoute> },
      { path: '/faculties',    element: <ProtectedRoute><FacultyList /></ProtectedRoute> },
      { path: '/venues',       element: <ProtectedRoute><VenueList /></ProtectedRoute> },
      { path: '/venues/new',   element: <ProtectedRoute><VenueEditor /></ProtectedRoute> },
      { path: '/venues/:id',   element: <ProtectedRoute><VenueEditor /></ProtectedRoute> },
      { path: '/settings',                        element: <ProtectedRoute><SystemSettings /></ProtectedRoute> },
      { path: '/finance/accounts',                    element: <ProtectedRoute><FinanceAccounts /></ProtectedRoute> },
      { path: '/finance/accounts/:id/configure',     element: <ProtectedRoute><ConfigureAccount /></ProtectedRoute> },
      { path: '/finance/payment-method-defaults',    element: <ProtectedRoute><PaymentMethodDefaults /></ProtectedRoute> },
      { path: '/finance/categories',                  element: <ProtectedRoute><FinanceCategories /></ProtectedRoute> },
      { path: '/finance/ledger',                      element: <ProtectedRoute><FinanceLedger /></ProtectedRoute> },
      { path: '/finance/transactions/new',            element: <ProtectedRoute><TransactionEditor /></ProtectedRoute> },
      { path: '/finance/transactions/:id/refund',    element: <ProtectedRoute><TransactionRefund /></ProtectedRoute> },
      { path: '/finance/transactions/:id',            element: <ProtectedRoute><TransactionEditor /></ProtectedRoute> },
      { path: '/finance/transfers',                   element: <ProtectedRoute><TransferMoney /></ProtectedRoute> },
      { path: '/finance/reconcile',                   element: <ProtectedRoute><ReconcileAccount /></ProtectedRoute> },
      { path: '/finance/statement',                   element: <ProtectedRoute><FinancialStatement /></ProtectedRoute> },
      { path: '/finance/groups-statement',            element: <ProtectedRoute><GroupsStatement /></ProtectedRoute> },
      { path: '/finance/gift-aid',                      element: <ProtectedRoute><GiftAidDeclaration /></ProtectedRoute> },
      { path: '/finance/batches',                       element: <ProtectedRoute><CreditBatches /></ProtectedRoute> },
      { path: '/utilities',                            element: <ProtectedRoute><Utilities /></ProtectedRoute> },
      { path: '/admin/validate-members',              element: <ProtectedRoute><MemberValidator /></ProtectedRoute> },
      { path: '/polls',                               element: <ProtectedRoute><PollList /></ProtectedRoute> },
      { path: '/custom-fields',                       element: <ProtectedRoute><CustomFields /></ProtectedRoute> },
      { path: '/audit',                               element: <ProtectedRoute><AuditLog /></ProtectedRoute> },
      { path: '/audit/:id',                            element: <ProtectedRoute><AuditRecord /></ProtectedRoute> },
      { path: '/gift-aid-log',                         element: <ProtectedRoute><GiftAidLog /></ProtectedRoute> },
      { path: '/officers',                            element: <ProtectedRoute><OfficerList /></ProtectedRoute> },
      { path: '/backup',                              element: <ProtectedRoute><DataBackup /></ProtectedRoute> },
      { path: '/preferences',                         element: <ProtectedRoute><PersonalPreferences /></ProtectedRoute> },
      { path: '/email/compose',                       element: <ProtectedRoute><EmailCompose /></ProtectedRoute> },
      { path: '/email/delivery',                      element: <ProtectedRoute><EmailDelivery /></ProtectedRoute> },
      { path: '/email/delivery/:id',                  element: <ProtectedRoute><EmailDeliveryDetail /></ProtectedRoute> },
      { path: '/email/unblocker',                     element: <ProtectedRoute><EmailUnblocker /></ProtectedRoute> },
      { path: '/system-messages',                       element: <ProtectedRoute><SystemMessages /></ProtectedRoute> },
      { path: '/public-links',                          element: <ProtectedRoute><PublicLinks /></ProtectedRoute> },
      { path: '/calendar',                               element: <ProtectedRoute><Calendar /></ProtectedRoute> },
      { path: '/calendar/open-meetings',                  element: <ProtectedRoute><OpenMeetings /></ProtectedRoute> },
      { path: '/letters/compose',                          element: <ProtectedRoute><LetterCompose /></ProtectedRoute> },

      // Public pages (no auth required)
      { path: '/public/:slug/join',                     element: <JoinForm /> },
      { path: '/public/:slug/join-complete',            element: <JoinComplete /> },
      { path: '/public/:slug/portal',                   element: <PortalLogin /> },
      { path: '/public/:slug/portal/register',          element: <PortalRegister /> },
      { path: '/public/:slug/portal/verify',            element: <PortalVerifyEmail /> },
      { path: '/public/:slug/portal/forgot-password',   element: <PortalForgotPassword /> },
      { path: '/public/:slug/portal/reset-password',    element: <PortalResetPassword /> },
    ],
  },
]);

function applyTheme() {
  const { textSize, colorTheme } = getPreferences();
  document.documentElement.dataset.textSize = textSize;
  document.documentElement.dataset.theme = colorTheme;
}

export default function App() {
  useEffect(() => {
    applyTheme();
    window.addEventListener('beacon2-prefs-changed', applyTheme);
    window.addEventListener('storage', applyTheme);
    return () => {
      window.removeEventListener('beacon2-prefs-changed', applyTheme);
      window.removeEventListener('storage', applyTheme);
    };
  }, []);

  return (
    <AuthProvider>
      <CookieConsent />
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
