import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          GenAI Widgets
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          A production-ready scaffolding template for building modern web applications
          with React, Vite, Tailwind CSS, and Netlify Functions.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          {user ? (
            <Link
              to="/dashboard"
              className="rounded-md bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/auth/signup"
                className="rounded-md bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                Get started
              </Link>
              <Link
                to="/auth/login"
                className="text-sm font-semibold leading-6 text-foreground"
              >
                Sign in <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
