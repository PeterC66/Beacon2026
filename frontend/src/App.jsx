// beacon2/frontend/src/App.jsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Login     from './pages/Login.jsx';
import RoleList  from './pages/roles/RoleList.jsx';
import RoleEditor from './pages/roles/RoleEditor.jsx';

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

          {/* Protected routes */}
          <Route path="/" element={<ProtectedRoute><Navigate to="/roles" replace /></ProtectedRoute>} />
          <Route path="/roles" element={<ProtectedRoute><RoleList /></ProtectedRoute>} />
          <Route path="/roles/new" element={<ProtectedRoute><RoleEditor /></ProtectedRoute>} />
          <Route path="/roles/:id" element={<ProtectedRoute><RoleEditor /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
