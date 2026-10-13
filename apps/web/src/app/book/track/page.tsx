'use client';

import { Suspense } from 'react';
import BookTrackPage from './TrackClient';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-[#5a7a60] bg-[#f7fbf4]">
          Loading tracker…
        </div>
      }
    >
      <BookTrackPage />
    </Suspense>
  );
}
