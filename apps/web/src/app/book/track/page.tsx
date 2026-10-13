'use client';

import { Suspense } from 'react';
import BookTrackPage from './TrackClient';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-[#c4a882] bg-[#1a120e]">
          Loading tracker…
        </div>
      }
    >
      <BookTrackPage />
    </Suspense>
  );
}
