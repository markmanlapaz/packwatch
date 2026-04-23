import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { hasAuth } from './lib/auth.js';
import { ToastProvider } from './components/Toast.jsx';
import FirstRun from './screens/FirstRun.jsx';
import Watchlist from './screens/Watchlist.jsx';
import AddWatch from './screens/AddWatch.jsx';
import EditWatch from './screens/EditWatch.jsx';

/**
 * Hash router is used so GitHub Pages doesn't need a 404.html fallback —
 * every route is served by /index.html and parsed client-side.
 */
export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<RootGate />} />
          <Route path="/setup" element={<FirstRun />} />
          <Route
            path="/add"
            element={<RequireAuth><AddWatch /></RequireAuth>}
          />
          <Route
            path="/edit/:id"
            element={<RequireAuth><EditWatch /></RequireAuth>}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ToastProvider>
  );
}

function RootGate() {
  return hasAuth() ? <Watchlist /> : <FirstRun />;
}

function RequireAuth({ children }) {
  return hasAuth() ? children : <Navigate to="/" replace />;
}
