import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import WatchForm from './WatchForm.jsx';
import Shell from '../components/Shell.jsx';
import { useWatchlist } from '../hooks/useWatchlist.js';

export default function EditWatch() {
  const { id } = useParams();
  const wl = useWatchlist();

  if (wl.loading) {
    return (
      <Shell lastCommittedAt={wl.lastCommittedAt}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 24,
            color: 'var(--ink-secondary)',
            padding: 40,
            textAlign: 'center',
          }}
        >
          Loading…
        </div>
      </Shell>
    );
  }

  const existing = wl.watches.find((w) => w.id === id);
  if (!existing) return <Navigate to="/" replace />;

  return <WatchForm mode="edit" existing={existing} wl={wl} />;
}
