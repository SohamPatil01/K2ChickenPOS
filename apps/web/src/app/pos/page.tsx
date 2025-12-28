"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function POSPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to store POS
    router.replace("/store/pos");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to Store POS...</p>
      </div>
    </div>
  );
}
