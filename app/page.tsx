import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground">
              M-Pesa Payment System
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Manage and track M-Pesa C2B payments, members, and payment disputes with a powerful
              dashboard
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Link
              href="/dashboard"
              className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium text-lg"
            >
              Go to Dashboard
            </Link>
            <a
              href="#features"
              className="px-8 py-3 border border-primary text-primary rounded-lg hover:bg-primary/10 transition font-medium text-lg"
            >
              Learn More
            </a>
          </div>
        </div>

        <div id="features" className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="bg-card rounded-lg border border-border p-6 space-y-3">
            <div className="text-3xl">💳</div>
            <h3 className="text-xl font-semibold text-foreground">Payment Tracking</h3>
            <p className="text-muted-foreground">
              Real-time tracking of all M-Pesa C2B transactions with detailed logs and filtering
            </p>
          </div>

          <div className="bg-card rounded-lg border border-border p-6 space-y-3">
            <div className="text-3xl">👥</div>
            <h3 className="text-xl font-semibold text-foreground">Member Management</h3>
            <p className="text-muted-foreground">
              Organize and manage member profiles, contact information, and payment history
            </p>
          </div>

          <div className="bg-card rounded-lg border border-border p-6 space-y-3">
            <div className="text-3xl">⚠️</div>
            <h3 className="text-xl font-semibold text-foreground">Case Management</h3>
            <p className="text-muted-foreground">
              Track and resolve payment disputes and failed transactions efficiently
            </p>
          </div>
        </div>

        <div className="mt-16 bg-card rounded-lg border border-border p-8 space-y-4">
          <h2 className="text-2xl font-bold text-foreground">API Integration Ready</h2>
          <p className="text-muted-foreground">
            Fully configured M-Pesa API endpoints for validation, confirmation, and transaction
            simulation. Environment variables support for secure credential management.
          </p>
        </div>
      </div>
    </main>
  );
}
