// beacon2/frontend/src/App.jsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
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
import GroupList         from './pages/groups/GroupList.jsx';
import GroupRecord       from './pages/groups/GroupRecord.jsx';
import SystemSettings    from './pages/settings/SystemSettings.jsx';
import FinanceAccounts    from './pages/finance/FinanceAccounts.jsx';
import FinanceCategories  from './pages/finance/FinanceCategories.jsx';
import FinanceLedger      from './pages/finance/FinanceLedger.jsx';
import TransactionEditor  from './pages/finance/TransactionEditor.jsx';
import ConfigureAccount   from './pages/finance/ConfigureAccount.jsx';
import MemberValidator    from './pages/admin/MemberValidator.jsx';
import PollList           from './pages/admin/PollList.jsx';
import AuditLog           from './pages/misc/AuditLog.jsx';
import OfficerList        from './pages/misc/OfficerList.jsx';
import PersonalPreferences from './pages/settings/PersonalPreferences.jsx';

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* System admin routes (auth handled inside pages via sessionStorage) */}
          <Route path="/system/login" element={<SystemLogin />} />
          <Route path="/system"       element={<SystemDashboard />} />

          {/* Protected tenant routes */}
          <Route path="/"           element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/roles"      element={<ProtectedRoute><RoleList /></ProtectedRoute>} />
          <Route path="/roles/new"  element={<ProtectedRoute><RoleEditor /></ProtectedRoute>} />
          <Route path="/roles/:id"  element={<ProtectedRoute><RoleEditor /></ProtectedRoute>} />
          <Route path="/users"      element={<ProtectedRoute><UserList /></ProtectedRoute>} />
          <Route path="/users/new"  element={<ProtectedRoute><UserEditor /></ProtectedRoute>} />
          <Route path="/users/:id"  element={<ProtectedRoute><UserEditor /></ProtectedRoute>} />
          <Route path="/membership/classes"      element={<ProtectedRoute><MemberClassList /></ProtectedRoute>} />
          <Route path="/membership/classes/new"  element={<ProtectedRoute><MemberClassEditor /></ProtectedRoute>} />
          <Route path="/membership/classes/:id"  element={<ProtectedRoute><MemberClassEditor /></ProtectedRoute>} />
          <Route path="/membership/statuses"     element={<ProtectedRoute><MemberStatusList /></ProtectedRoute>} />
          <Route path="/members"      element={<ProtectedRoute><MemberList /></ProtectedRoute>} />
          <Route path="/members/new"  element={<ProtectedRoute><MemberEditor /></ProtectedRoute>} />
          <Route path="/members/:id"  element={<ProtectedRoute><MemberEditor /></ProtectedRoute>} />
          <Route path="/groups"       element={<ProtectedRoute><GroupList /></ProtectedRoute>} />
          <Route path="/groups/new"   element={<ProtectedRoute><GroupRecord /></ProtectedRoute>} />
          <Route path="/groups/:id"   element={<ProtectedRoute><GroupRecord /></ProtectedRoute>} />
          <Route path="/settings"                        element={<ProtectedRoute><SystemSettings /></ProtectedRoute>} />
          <Route path="/finance/accounts"                    element={<ProtectedRoute><FinanceAccounts /></ProtectedRoute>} />
          <Route path="/finance/accounts/:id/configure"     element={<ProtectedRoute><ConfigureAccount /></ProtectedRoute>} />
          <Route path="/finance/categories"                  element={<ProtectedRoute><FinanceCategories /></ProtectedRoute>} />
          <Route path="/finance/ledger"                      element={<ProtectedRoute><FinanceLedger /></ProtectedRoute>} />
          <Route path="/finance/transactions/new"            element={<ProtectedRoute><TransactionEditor /></ProtectedRoute>} />
          <Route path="/finance/transactions/:id"            element={<ProtectedRoute><TransactionEditor /></ProtectedRoute>} />
          <Route path="/admin/validate-members"              element={<ProtectedRoute><MemberValidator /></ProtectedRoute>} />
          <Route path="/polls"                               element={<ProtectedRoute><PollList /></ProtectedRoute>} />
          <Route path="/audit"                               element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
          <Route path="/officers"                            element={<ProtectedRoute><OfficerList /></ProtectedRoute>} />
          <Route path="/preferences"                         element={<ProtectedRoute><PersonalPreferences /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
