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
import TeamList          from './pages/groups/TeamList.jsx';
import TeamRecord        from './pages/groups/TeamRecord.jsx';
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
import JoinPending         from './pages/public/JoinPending.jsx';
import JoinComplete        from './pages/public/JoinComplete.jsx';
import ResumePayment       from './pages/public/ResumePayment.jsx';
import PortalLogin         from './pages/public/PortalLogin.jsx';
import PortalHome          from './pages/public/PortalHome.jsx';
import PortalGroups        from './pages/public/PortalGroups.jsx';
import PortalCalendar      from './pages/public/PortalCalendar.jsx';
import PublicGroups        from './pages/public/PublicGroups.jsx';
import PublicCalendar      from './pages/public/PublicCalendar.jsx';
import PortalPersonalDetails from './pages/public/PortalPersonalDetails.jsx';
import PortalRequestCard   from './pages/public/PortalRequestCard.jsx';
import PortalRenewal       from './pages/public/PortalRenewal.jsx';
import PortalRegister      from './pages/public/PortalRegister.jsx';
import PortalVerifyEmail   from './pages/public/PortalVerifyEmail.jsx';
import PortalForgotPassword from './pages/public/PortalForgotPassword.jsx';
import PortalResetPassword  from './pages/public/PortalResetPassword.jsx';
import ChangePassword       from './pages/ChangePassword.jsx';
import CustomFields         from './pages/settings/CustomFields.jsx';
import EventTypeList        from './pages/settings/EventTypeList.jsx';
import FeatureConfig        from './pages/settings/FeatureConfig.jsx';

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

/** Redirects to Home if a feature toggle is disabled. */
function FeatureRoute({ feature, children }) {
  const { hasFeature } = useAuth();
  if (!hasFeature(feature)) return <Navigate to="/" replace />;
  return children;
}

/** Shorthand: ProtectedRoute + FeatureRoute */
function PF({ feature, children }) {
  return <ProtectedRoute><FeatureRoute feature={feature}>{children}</FeatureRoute></ProtectedRoute>;
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

      // Protected tenant routes — always available
      { path: '/',           element: <ProtectedRoute><Home /></ProtectedRoute> },
      { path: '/roles',      element: <ProtectedRoute><RoleList /></ProtectedRoute> },
      { path: '/roles/new',  element: <ProtectedRoute><RoleEditor /></ProtectedRoute> },
      { path: '/roles/:id',  element: <ProtectedRoute><RoleEditor /></ProtectedRoute> },
      { path: '/users',      element: <ProtectedRoute><UserList /></ProtectedRoute> },
      { path: '/users/new',  element: <ProtectedRoute><UserEditor /></ProtectedRoute> },
      { path: '/users/:id',  element: <ProtectedRoute><UserEditor /></ProtectedRoute> },
      { path: '/settings',            element: <ProtectedRoute><SystemSettings /></ProtectedRoute> },
      { path: '/feature-config',      element: <ProtectedRoute><FeatureConfig /></ProtectedRoute> },
      { path: '/utilities',           element: <ProtectedRoute><Utilities /></ProtectedRoute> },
      { path: '/admin/validate-members', element: <ProtectedRoute><MemberValidator /></ProtectedRoute> },
      { path: '/audit',               element: <ProtectedRoute><AuditLog /></ProtectedRoute> },
      { path: '/audit/:id',           element: <ProtectedRoute><AuditRecord /></ProtectedRoute> },
      { path: '/officers',            element: <ProtectedRoute><OfficerList /></ProtectedRoute> },
      { path: '/backup',              element: <ProtectedRoute><DataBackup /></ProtectedRoute> },
      { path: '/preferences',         element: <ProtectedRoute><PersonalPreferences /></ProtectedRoute> },
      { path: '/public-links',        element: <ProtectedRoute><PublicLinks /></ProtectedRoute> },

      // Membership — always available (core), sub-features gated
      { path: '/members',             element: <ProtectedRoute><MemberList /></ProtectedRoute> },
      { path: '/members/new',         element: <ProtectedRoute><MemberEditor /></ProtectedRoute> },
      { path: '/members/:id',         element: <ProtectedRoute><MemberEditor /></ProtectedRoute> },
      { path: '/members/:id/compact', element: <ProtectedRoute><MemberCompactView /></ProtectedRoute> },
      { path: '/members/recent',      element: <ProtectedRoute><RecentMembers /></ProtectedRoute> },
      { path: '/membership/classes',      element: <ProtectedRoute><MemberClassList /></ProtectedRoute> },
      { path: '/membership/classes/new',  element: <ProtectedRoute><MemberClassEditor /></ProtectedRoute> },
      { path: '/membership/classes/:id',  element: <ProtectedRoute><MemberClassEditor /></ProtectedRoute> },
      { path: '/membership/statuses',     element: <ProtectedRoute><MemberStatusList /></ProtectedRoute> },
      { path: '/membership/renewals',     element: <PF feature="membershipRenewals"><MembershipRenewals /></PF> },
      { path: '/membership/non-renewals', element: <PF feature="membershipRenewals"><NonRenewals /></PF> },
      { path: '/membership/cards',        element: <PF feature="membershipCards"><MembershipCards /></PF> },
      { path: '/members/statistics',      element: <PF feature="statistics"><MemberStatistics /></PF> },
      { path: '/addresses-export',        element: <PF feature="addressesExport"><AddressesExport /></PF> },
      { path: '/polls',                   element: <PF feature="polls"><PollList /></PF> },
      { path: '/custom-fields',           element: <PF feature="customFields"><CustomFields /></PF> },
      { path: '/gift-aid-log',            element: <PF feature="giftAid"><GiftAidLog /></PF> },

      // Groups — gated by 'groups' master toggle
      { path: '/groups',       element: <PF feature="groups"><GroupList /></PF> },
      { path: '/groups/new',   element: <PF feature="groups"><GroupRecord /></PF> },
      { path: '/groups/:id',   element: <PF feature="groups"><GroupRecord /></PF> },
      { path: '/teams',        element: <PF feature="teams"><TeamList /></PF> },
      { path: '/teams/new',    element: <PF feature="teams"><TeamRecord /></PF> },
      { path: '/teams/:id',    element: <PF feature="teams"><TeamRecord /></PF> },
      { path: '/faculties',    element: <PF feature="faculties"><FacultyList /></PF> },
      { path: '/venues',       element: <PF feature="venues"><VenueList /></PF> },
      { path: '/venues/new',   element: <PF feature="venues"><VenueEditor /></PF> },
      { path: '/venues/:id',   element: <PF feature="venues"><VenueEditor /></PF> },

      // Events & Calendar — gated by 'events' / sub-toggles
      { path: '/calendar',                element: <PF feature="calendar"><Calendar /></PF> },
      { path: '/calendar/open-meetings', element: <PF feature="calendar"><OpenMeetings /></PF> },
      { path: '/event-types',            element: <PF feature="eventTypes"><EventTypeList /></PF> },

      // Finance — gated by 'finance' master toggle + sub-toggles
      { path: '/finance/accounts',                   element: <PF feature="finance"><FinanceAccounts /></PF> },
      { path: '/finance/accounts/:id/configure',     element: <PF feature="finance"><ConfigureAccount /></PF> },
      { path: '/finance/payment-method-defaults',    element: <PF feature="finance"><PaymentMethodDefaults /></PF> },
      { path: '/finance/categories',                 element: <PF feature="finance"><FinanceCategories /></PF> },
      { path: '/finance/ledger',                     element: <PF feature="finance"><FinanceLedger /></PF> },
      { path: '/finance/transactions/new',           element: <PF feature="finance"><TransactionEditor /></PF> },
      { path: '/finance/transactions/:id/refund',    element: <PF feature="finance"><TransactionRefund /></PF> },
      { path: '/finance/transactions/:id',           element: <PF feature="finance"><TransactionEditor /></PF> },
      { path: '/finance/transfers',                  element: <PF feature="transferMoney"><TransferMoney /></PF> },
      { path: '/finance/reconcile',                  element: <PF feature="reconciliation"><ReconcileAccount /></PF> },
      { path: '/finance/statement',                  element: <PF feature="financialStatement"><FinancialStatement /></PF> },
      { path: '/finance/groups-statement',           element: <PF feature="groupsStatement"><GroupsStatement /></PF> },
      { path: '/finance/gift-aid',                   element: <PF feature="giftAid"><GiftAidDeclaration /></PF> },
      { path: '/finance/batches',                    element: <PF feature="creditBatches"><CreditBatches /></PF> },

      // Email & Letters — gated by 'email' master toggle
      { path: '/email/compose',        element: <PF feature="email"><EmailCompose /></PF> },
      { path: '/email/delivery',       element: <PF feature="email"><EmailDelivery /></PF> },
      { path: '/email/delivery/:id',   element: <PF feature="email"><EmailDeliveryDetail /></PF> },
      { path: '/email/unblocker',      element: <PF feature="email"><EmailUnblocker /></PF> },
      { path: '/system-messages',      element: <PF feature="email"><SystemMessages /></PF> },
      { path: '/letters/compose',      element: <PF feature="email"><LetterCompose /></PF> },

      // Public pages (no auth required)
      { path: '/public/:slug/join',                     element: <JoinForm /> },
      { path: '/public/:slug/join-pending',             element: <JoinPending /> },
      { path: '/public/:slug/join-complete',            element: <JoinComplete /> },
      { path: '/public/:slug/resume-payment/:token',    element: <ResumePayment /> },
      { path: '/public/:slug/groups',                    element: <PublicGroups /> },
      { path: '/public/:slug/calendar',                  element: <PublicCalendar /> },
      { path: '/public/:slug/portal',                   element: <PortalLogin /> },
      { path: '/public/:slug/portal/home',              element: <PortalHome /> },
      { path: '/public/:slug/portal/groups',            element: <PortalGroups /> },
      { path: '/public/:slug/portal/calendar',          element: <PortalCalendar /> },
      { path: '/public/:slug/portal/personal-details',  element: <PortalPersonalDetails /> },
      { path: '/public/:slug/portal/request-card',      element: <PortalRequestCard /> },
      { path: '/public/:slug/portal/renewal',           element: <PortalRenewal /> },
      { path: '/public/:slug/portal/renewal-complete',  element: <PortalRenewal /> },
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
