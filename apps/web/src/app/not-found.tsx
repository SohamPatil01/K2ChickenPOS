import Link from 'next/link';

/** Custom not-found UI for unmatched App Router routes. */
export default function NotFound() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-6xl font-bold text-gray-300 dark:text-gray-600 mb-2">404</p>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Page not found</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors"
      >
        Back to home
      </Link>
    </div>
  );
}
