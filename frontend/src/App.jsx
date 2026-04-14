// beacon2/frontend/src/App.jsx

import { useEffect, lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { getPreferences } from './hooks/usePreferences.js';
import CookieConsent   from './components/CookieConsent.jsx';
import HelpWidget from './components/HelpWidget.jsx';

// Pages — lazy-loaded for code splitting
const Login              = lazy(() => import('./pages/Login.jsx'));
const Home               = lazy(() => import('./pages/Home.jsx'));
const RoleList           = lazy(() => import('./pages/roles/RoleList.jsx'));
const RoleEditor         = lazy(() => import('./pages/roles/RoleEditor.jsx'));
const UserList           = lazy(() => import('./pages/users/UserList.jsx'));
const UserEditor         = lazy(() => import('./pages/users/UserEditor.jsx'));
const SystemLogin        = lazy(() => import('./pages/system/SystemLogin.jsx'));
const SystemDashboard    = lazy(() => import('./pages/system/SystemDashboard.jsx'));
const MemberClassList    = lazy(() => import('./pages/membership/MemberClassList.jsx'));
const MemberClassEditor  = lazy(() => import('./pages/membership/MemberClassEditor.jsx'));
const MemberStatusList   = lazy(() => import('./pages/membership/MemberStatusList.jsx'));
const MemberList         = lazy(() => import('./pages/members/MemberList.jsx'));
const MemberEditor       = lazy(() => import('./pages/members/MemberEditor.jsx'));
const MemberCompactView  = lazy(() => import('./pages/members/MemberCompactView.jsx'));
const AddressesExport    = lazy(() => import('./pages/members/AddressesExport.jsx'));
const GroupList          = lazy(() => import('./pages/groups/GroupList.jsx'));
const GroupRecord        = lazy(() => import('./pages/groups/GroupRecord.jsx'));
const TeamList           = lazy(() => import('./pages/groups/TeamList.jsx'));
const TeamRecord         = lazy(() => import('./pages/groups/TeamRecord.jsx'));
const FacultyList        = lazy(() => import('./pages/groups/FacultyList.jsx'));
const VenueList          = lazy(() => import('./pages/groups/VenueList.jsx'));
const VenueEditor        = lazy(() => import('./pages/groups/VenueEditor.jsx'));
const SystemSettings     = lazy(() => import('./pages/settings/SystemSettings.jsx'));
const FinanceAccounts    = lazy(() => import('./pages/finance/FinanceAccounts.jsx'));
const FinanceCategories  = lazy(() => import('./pages/finance/FinanceCategories.jsx'));
const FinanceLedger      = lazy(() => import('./pages/finance/FinanceLedger.jsx'));
const TransactionEditor  = lazy(() => import('./pages/finance/TransactionEditor.jsx'));
const TransactionRefund  = lazy(() => import('./pages/finance/TransactionRefund.jsx'));
const ConfigureAccount   = lazy(() => import('./pages/finance/ConfigureAccount.jsx'));
const PaymentMethodDefaults = lazy(() => import('./pages/finance/PaymentMethodDefaults.jsx'));
const TransferMoney      = lazy(() => import('./pages/finance/TransferMoney.jsx'));
const ReconcileAccount   = lazy(() => import('./pages/finance/ReconcileAccount.jsx'));
const FinancialStatement = lazy(() => import('./pages/finance/FinancialStatement.jsx'));
const GroupsStatement    = lazy(() => import('./pages/finance/GroupsStatement.jsx'));
const GiftAidDeclaration = lazy(() => import('./pages/finance/GiftAidDeclaration.jsx'));
const CreditBatches      = lazy(() => import('./pages/finance/CreditBatches.jsx'));
const MemberValidator    = lazy(() => import('./pages/admin/MemberValidator.jsx'));
const Utilities          = lazy(() => import('./pages/admin/Utilities.jsx'));
const PollList           = lazy(() => import('./pages/admin/PollList.jsx'));
const AuditLog           = lazy(() => import('./pages/misc/AuditLog.jsx'));
const AuditRecord        = lazy(() => import('./pages/misc/AuditRecord.jsx'));
const GiftAidLog         = lazy(() => import('./pages/misc/GiftAidLog.jsx'));
const OfficerList        = lazy(() => import('./pages/misc/OfficerList.jsx'));
const DataBackup         = lazy(() => import('./pages/misc/DataBackup.jsx'));
const PersonalPreferences = lazy(() => import('./pages/settings/PersonalPreferences.jsx'));
const RecentMembers      = lazy(() => import('./pages/members/RecentMembers.jsx'));
const MemberStatistics   = lazy(() => import('./pages/members/MemberStatistics.jsx'));
const MembershipRenewals = lazy(() => import('./pages/membership/MembershipRenewals.jsx'));
const NonRenewals        = lazy(() => import('./pages/membership/NonRenewals.jsx'));
const MembershipCards    = lazy(() => import('./pages/membership/MembershipCards.jsx'));
const EmailCompose       = lazy(() => import('./pages/email/EmailCompose.jsx'));
const EmailDelivery      = lazy(() => import('./pages/email/EmailDelivery.jsx'));
const EmailDeliveryDetail = lazy(() => import('./pages/email/EmailDeliveryDetail.jsx'));
const EmailUnblocker     = lazy(() => import('./pages/email/EmailUnblocker.jsx'));
const SystemMessages     = lazy(() => import('./pages/settings/SystemMessages.jsx'));
const PublicLinks        = lazy(() => import('./pages/misc/PublicLinks.jsx'));
const Calendar           = lazy(() => import('./pages/groups/Calendar.jsx'));
const EventRecord        = lazy(() => import('./pages/groups/EventRecord.jsx'));
const OpenMeetings       = lazy(() => import('./pages/groups/OpenMeetings.jsx'));
const LetterCompose      = lazy(() => import('./pages/letters/LetterCompose.jsx'));
const JoinForm           = lazy(() => import('./pages/public/JoinForm.jsx'));
const JoinPending        = lazy(() => import('./pages/public/JoinPending.jsx'));
const JoinComplete       = lazy(() => import('./pages/public/JoinComplete.jsx'));
const ResumePayment      = lazy(() => import('./pages/public/ResumePayment.jsx'));
const PortalLogin        = lazy(() => import('./pages/public/PortalLogin.jsx'));
const PortalHome         = lazy(() => import('./pages/public/PortalHome.jsx'));
const PortalGroups       = lazy(() => import('./pages/public/PortalGroups.jsx'));
const PortalCalendar     = lazy(() => import('./pages/public/PortalCalendar.jsx'));
const PublicGroups       = lazy(() => import('./pages/public/PublicGroups.jsx'));
const PublicCalendar     = lazy(() => import('./pages/public/PublicCalendar.jsx'));
const PortalPersonalDetails = lazy(() => import('./pages/public/PortalPersonalDetails.jsx'));
const PortalRequestCard  = lazy(() => import('./pages/public/PortalRequestCard.jsx'));
const PortalRenewal      = lazy(() => import('./pages/public/PortalRenewal.jsx'));
const PortalRegister     = lazy(() => import('./pages/public/PortalRegister.jsx'));
const PortalVerifyEmail  = lazy(() => import('./pages/public/PortalVerifyEmail.jsx'));
const PortalForgotPassword = lazy(() => import('./pages/public/PortalForgotPassword.jsx'));
const PortalResetPassword = lazy(() => import('./pages/public/PortalResetPassword.jsx'));
const ChangePassword     = lazy(() => import('./pages/ChangePassword.jsx'));
const CustomFields       = lazy(() => import('./pages/settings/CustomFields.jsx'));
const EventTypeList      = lazy(() => import('./pages/settings/EventTypeList.jsx'));
const FeatureConfig      = lazy(() => import('./pages/settings/FeatureConfig.jsx'));

function ProtectedRoute({ skipPasswordCheck, children }) {
  const { isLoggedIn, mustChangePassword } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!skipPasswordCheck && mustChangePassword) return <Navigate to="/change-password" replace />;
  return children;
}

/** Redirects to Home if a feature toggle is disabled. */
function FeatureRoute({ feature, children }) {
  const { hasFeature } = useAuth();
  if (!hasFeature(feature)) return <Navigate to="/" replace />;
  return children;
}

/** ProtectedRoute + FeatureRoute combined. */
function ProtectedFeatureRoute({ feature, children }) {
  return <ProtectedRoute><FeatureRoute feature={feature}>{children}</FeatureRoute></ProtectedRoute>;
}

function RootLayout() {
  return (
    <>
      <Suspense fallback={<p className="text-center text-slate-500 py-8">Loading...</p>}>
        <Outlet />
      </Suspense>
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
      { path: '/change-password', element: <ProtectedRoute skipPasswordCheck><ChangePassword /></ProtectedRoute> },

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
      { path: '/membership/renewals',     element: <ProtectedFeatureRoute feature="membershipRenewals"><MembershipRenewals /></ProtectedFeatureRoute> },
      { path: '/membership/non-renewals', element: <ProtectedFeatureRoute feature="membershipRenewals"><NonRenewals /></ProtectedFeatureRoute> },
      { path: '/membership/cards',        element: <ProtectedFeatureRoute feature="membershipCards"><MembershipCards /></ProtectedFeatureRoute> },
      { path: '/members/statistics',      element: <ProtectedFeatureRoute feature="statistics"><MemberStatistics /></ProtectedFeatureRoute> },
      { path: '/addresses-export',        element: <ProtectedFeatureRoute feature="addressesExport"><AddressesExport /></ProtectedFeatureRoute> },
      { path: '/polls',                   element: <ProtectedFeatureRoute feature="polls"><PollList /></ProtectedFeatureRoute> },
      { path: '/custom-fields',           element: <ProtectedFeatureRoute feature="customFields"><CustomFields /></ProtectedFeatureRoute> },
      { path: '/gift-aid-log',            element: <ProtectedFeatureRoute feature="giftAid"><GiftAidLog /></ProtectedFeatureRoute> },

      // Groups — gated by 'groups' master toggle
      { path: '/groups',       element: <ProtectedFeatureRoute feature="groups"><GroupList /></ProtectedFeatureRoute> },
      { path: '/groups/new',   element: <ProtectedFeatureRoute feature="groups"><GroupRecord /></ProtectedFeatureRoute> },
      { path: '/groups/:id',   element: <ProtectedFeatureRoute feature="groups"><GroupRecord /></ProtectedFeatureRoute> },
      { path: '/teams',        element: <ProtectedFeatureRoute feature="teams"><TeamList /></ProtectedFeatureRoute> },
      { path: '/teams/new',    element: <ProtectedFeatureRoute feature="teams"><TeamRecord /></ProtectedFeatureRoute> },
      { path: '/teams/:id',    element: <ProtectedFeatureRoute feature="teams"><TeamRecord /></ProtectedFeatureRoute> },
      { path: '/faculties',    element: <ProtectedFeatureRoute feature="faculties"><FacultyList /></ProtectedFeatureRoute> },
      { path: '/venues',       element: <ProtectedFeatureRoute feature="venues"><VenueList /></ProtectedFeatureRoute> },
      { path: '/venues/new',   element: <ProtectedFeatureRoute feature="venues"><VenueEditor /></ProtectedFeatureRoute> },
      { path: '/venues/:id',   element: <ProtectedFeatureRoute feature="venues"><VenueEditor /></ProtectedFeatureRoute> },

      // Events & Calendar — gated by 'events' / sub-toggles
      { path: '/calendar',                      element: <ProtectedFeatureRoute feature="calendar"><Calendar /></ProtectedFeatureRoute> },
      { path: '/calendar/events/:eventId',      element: <ProtectedFeatureRoute feature="calendar"><EventRecord /></ProtectedFeatureRoute> },
      { path: '/calendar/open-meetings',        element: <ProtectedFeatureRoute feature="calendar"><OpenMeetings /></ProtectedFeatureRoute> },
      { path: '/event-types',            element: <ProtectedFeatureRoute feature="eventTypes"><EventTypeList /></ProtectedFeatureRoute> },

      // Finance — gated by 'finance' master toggle + sub-toggles
      { path: '/finance/accounts',                   element: <ProtectedFeatureRoute feature="finance"><FinanceAccounts /></ProtectedFeatureRoute> },
      { path: '/finance/accounts/:id/configure',     element: <ProtectedFeatureRoute feature="finance"><ConfigureAccount /></ProtectedFeatureRoute> },
      { path: '/finance/payment-method-defaults',    element: <ProtectedFeatureRoute feature="finance"><PaymentMethodDefaults /></ProtectedFeatureRoute> },
      { path: '/finance/categories',                 element: <ProtectedFeatureRoute feature="finance"><FinanceCategories /></ProtectedFeatureRoute> },
      { path: '/finance/ledger',                     element: <ProtectedFeatureRoute feature="finance"><FinanceLedger /></ProtectedFeatureRoute> },
      { path: '/finance/transactions/new',           element: <ProtectedFeatureRoute feature="finance"><TransactionEditor /></ProtectedFeatureRoute> },
      { path: '/finance/transactions/:id/refund',    element: <ProtectedFeatureRoute feature="finance"><TransactionRefund /></ProtectedFeatureRoute> },
      { path: '/finance/transactions/:id',           element: <ProtectedFeatureRoute feature="finance"><TransactionEditor /></ProtectedFeatureRoute> },
      { path: '/finance/transfers',                  element: <ProtectedFeatureRoute feature="transferMoney"><TransferMoney /></ProtectedFeatureRoute> },
      { path: '/finance/reconcile',                  element: <ProtectedFeatureRoute feature="reconciliation"><ReconcileAccount /></ProtectedFeatureRoute> },
      { path: '/finance/statement',                  element: <ProtectedFeatureRoute feature="financialStatement"><FinancialStatement /></ProtectedFeatureRoute> },
      { path: '/finance/groups-statement',           element: <ProtectedFeatureRoute feature="groupsStatement"><GroupsStatement /></ProtectedFeatureRoute> },
      { path: '/finance/gift-aid',                   element: <ProtectedFeatureRoute feature="giftAid"><GiftAidDeclaration /></ProtectedFeatureRoute> },
      { path: '/finance/batches',                    element: <ProtectedFeatureRoute feature="creditBatches"><CreditBatches /></ProtectedFeatureRoute> },

      // Email & Letters — gated by 'email' master toggle
      { path: '/email/compose',        element: <ProtectedFeatureRoute feature="email"><EmailCompose /></ProtectedFeatureRoute> },
      { path: '/email/delivery',       element: <ProtectedFeatureRoute feature="email"><EmailDelivery /></ProtectedFeatureRoute> },
      { path: '/email/delivery/:id',   element: <ProtectedFeatureRoute feature="email"><EmailDeliveryDetail /></ProtectedFeatureRoute> },
      { path: '/email/unblocker',      element: <ProtectedFeatureRoute feature="email"><EmailUnblocker /></ProtectedFeatureRoute> },
      { path: '/system-messages',      element: <ProtectedFeatureRoute feature="email"><SystemMessages /></ProtectedFeatureRoute> },
      { path: '/letters/compose',      element: <ProtectedFeatureRoute feature="email"><LetterCompose /></ProtectedFeatureRoute> },

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
