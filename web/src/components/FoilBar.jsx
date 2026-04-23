import React, { useRef } from 'react';

/**
 * The signature flourish — a 3px holographic gradient stripe.
 * Subtly tilts toward the cursor, like a real foil card.
 */
export default function FoilBar({ dim = false, height = 44 }) {
  const ref = useRef(null);

  function onMove(e) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) / Math.max(1, rect.width);
    const dy = (e.clientY - (rect.top + rect.height / 2)) / Math.max(1, rect.height);
    const ry = Math.max(-25, Math.min(25, dx * 22));
    const rx = Math.max(-15, Math.min(15, -dy * 14));
    el.style.transform = `perspective(220px) rotateY(${ry}deg) rotateX(${rx}deg)`;
  }
  function onLeave() {
    const el = ref.current;
    if (el) el.style.transform = '';
  }

  return (
    <div
      ref={ref}
      className="pw-foil-stripe"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ height, opacity: dim ? 0.3 : 1 }}
      aria-hidden="true"
    />
  );
}
