import React from 'react';
import WatchForm from './WatchForm.jsx';
import { useWatchlist } from '../hooks/useWatchlist.js';

export default function AddWatch() {
  const wl = useWatchlist();
  return <WatchForm mode="add" wl={wl} />;
}
