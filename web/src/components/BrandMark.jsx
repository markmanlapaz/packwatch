import React from 'react';

/** The animated holographic "PACKWATCH" wordmark. */
export default function BrandMark({ size = 'md' }) {
  const px = size === 'sm' ? 36 : size === 'lg' ? 64 : 50;
  return (
    <span
      className="pw-holo-text select-none"
      style={{
        fontFamily: 'var(--font-crt)',
        fontSize: px,
        lineHeight: 0.85,
        letterSpacing: '-0.02em',
      }}
      aria-label="PackWatch"
    >
      PACKWATCH
    </span>
  );
}
