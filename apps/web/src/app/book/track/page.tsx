'use client';

import { Suspense } from 'react';
import BookTrackPage from './TrackClient';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          className="k2-book"
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            color: '#73747a',
            fontSize: 13,
          }}
        >
          Loading tracker…
        </div>
      }
    >
      <BookTrackPage />
    </Suspense>
  );
}
