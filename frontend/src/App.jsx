// beacon2/frontend/src/App.jsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Login           from './pages/Login.jsx';
import Home            from './pages/Home.jsx';
import RoleList        from './pages/roles/RoleList.jsx';
import RoleEditor      from './pages/roles/RoleEditor.jsx';
import UserList        from './pages/users/UserList.jsx';
import UserEditor      from './pages/users/UserEditor.jsx';
import SystemLogin     from './pages/system/SystemLogin.jsx';
import SystemDashboard from './pages/system/SystemDashboard.jsx';

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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
