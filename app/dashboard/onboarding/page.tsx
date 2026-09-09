'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';

const steps = ['Business', 'M-Pesa', 'Features', 'Test', 'Complete'];

type Setup = 'paybill' | 'till' | 'stk';

export default function MpesaOnboardingPage() {
  const [step, setStep] = useState(0);
  const [setup, setSetup] = useState<Setup[]>(['paybill', 'stk']);
  const [business, setBusiness] = useState({ name: '', phone: '', email: '', industry: '' });
  const [mpesa, setMpesa] = useState({ shortcode: '', accountFormat: 'invoice' });
  const [features, setFeatures] = useState({ sms: true, email: true, whatsapp: false, webhook: true });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSetup = (value: Setup) => {
    setSetup((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const canContinue = useMemo(() => {
    if (step === 0) return business.name.trim() && business.phone.trim() && business.email.trim();
    if (step === 1) return setup.length > 0 && mpesa.shortcode.trim();
    return true;
  }, [step, business, setup, mpesa]);

  const next = () => {
    setError(null);
    if (!canContinue) {
      setError(step === 0 ? 'Complete the required business details.' : 'Select at least one payment method and enter your shortcode.');
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/mpesa/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 10, phone: business.phone, shortcode: mpesa.shortcode, reference: 'ONBOARDING-TEST' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Test failed');
      setTestResult('Test transaction accepted. Your callback flow is responding correctly.');
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : 'Test failed.');
    } finally {
      setTesting(false);
    }
  };

  const finish = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business, setup, mpesa, features }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Could not save onboarding');
      setSaved(true);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save onboarding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Mobiwave Payments</p>
          <h1 className="text-3xl font-bold text-foreground mt-1">Connect your M-Pesa account</h1>
          <p className="text-muted-foreground mt-2">A guided setup for PayBill, Till and STK Push.</p>
        </div>
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Back to dashboard</Link>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {steps.map((label, index) => (
          <div key={label} className="space-y-2">
            <div className={`h-2 rounded-full ${index <= step ? 'bg-primary' : 'bg-muted'}`} />
            <p className={`text-xs ${index === step ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{index + 1}. {label}</p>
          </div>
        ))}
      </div>

      {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={finish} className="bg-card border border-border rounded-xl p-6 md:p-8">
        {step === 0 && (
          <section className="space-y-6">
            <div><h2 className="text-xl font-semibold">Tell us about your business</h2><p className="text-sm text-muted-foreground mt-1">These details identify your Mobiwave Payments workspace.</p></div>
            <div className="grid md:grid-cols-2 gap-5">
              <Field label="Business name" value={business.name} onChange={(value) => setBusiness({ ...business, name: value })} required />
              <Field label="Phone number" value={business.phone} onChange={(value) => setBusiness({ ...business, phone: value })} placeholder="07XX XXX XXX" required />
              <Field label="Email" type="email" value={business.email} onChange={(value) => setBusiness({ ...business, email: value })} required />
              <Field label="Industry" value={business.industry} onChange={(value) => setBusiness({ ...business, industry: value })} placeholder="e.g. retail, school, clinic" />
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-6">
            <div><h2 className="text-xl font-semibold">Choose your M-Pesa setup</h2><p className="text-sm text-muted-foreground mt-1">You can enable more than one payment flow.</p></div>
            <div className="grid md:grid-cols-3 gap-4">
              {([['paybill', 'PayBill', 'Receive C2B payments against an account or reference.'], ['till', 'Till', 'Accept payments directly to your business Till.'], ['stk', 'STK Push', 'Prompt customers to complete a payment on their phone.']] as const).map(([value, title, description]) => (
                <button type="button" key={value} onClick={() => toggleSetup(value)} className={`text-left rounded-xl border p-5 transition ${setup.includes(value) ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:bg-muted/50'}`}>
                  <div className="flex items-center justify-between"><span className="font-semibold">{title}</span><span className={`h-5 w-5 rounded-full border flex items-center justify-center text-xs ${setup.includes(value) ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>{setup.includes(value) ? '✓' : ''}</span></div>
                  <p className="text-sm text-muted-foreground mt-2">{description}</p>
                </button>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <Field label="M-Pesa business shortcode" value={mpesa.shortcode} onChange={(value) => setMpesa({ ...mpesa, shortcode: value })} placeholder="PayBill or Till number" required />
              {setup.includes('paybill') && <label className="block"><span className="block text-sm font-medium mb-2">Reference format</span><select value={mpesa.accountFormat} onChange={(event) => setMpesa({ ...mpesa, accountFormat: event.target.value })} className="w-full rounded-lg border border-border bg-background px-4 py-2.5"><option value="invoice">Invoice / order number</option><option value="customer">Customer number</option><option value="phone">Customer phone</option><option value="freeform">Free-form reference</option></select></label>}
            </div>
            <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">Mobiwave will expose the validation and confirmation callback endpoints automatically. Do not paste M-Pesa secrets into this form.</div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-6">
            <div><h2 className="text-xl font-semibold">Payment notifications & developer tools</h2><p className="text-sm text-muted-foreground mt-1">Choose what should happen after a successful payment.</p></div>
            <div className="space-y-3">
              {([['sms', 'SMS receipt', 'Send a payment confirmation by SMS.'], ['email', 'Email receipt', 'Send a payment confirmation to the customer email.'], ['whatsapp', 'WhatsApp notification', 'Notify customers through WhatsApp.'], ['webhook', 'Developer webhook', 'Notify your application when payment state changes.']] as const).map(([key, title, description]) => (
                <label key={key} className="flex items-center justify-between gap-4 rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/40"><span><span className="font-medium block">{title}</span><span className="text-sm text-muted-foreground">{description}</span></span><input type="checkbox" checked={features[key]} onChange={(event) => setFeatures({ ...features, [key]: event.target.checked })} className="h-5 w-5" /></label>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-6">
            <div><h2 className="text-xl font-semibold">Run a safe onboarding test</h2><p className="text-sm text-muted-foreground mt-1">This uses the repository's simulation endpoint; it does not charge a customer.</p></div>
            <div className="rounded-xl border border-border p-6 space-y-4"><div className="grid sm:grid-cols-3 gap-4 text-sm"><div><p className="text-muted-foreground">Shortcode</p><p className="font-semibold mt-1">{mpesa.shortcode}</p></div><div><p className="text-muted-foreground">Test amount</p><p className="font-semibold mt-1">KES 10</p></div><div><p className="text-muted-foreground">Reference</p><p className="font-semibold mt-1">ONBOARDING-TEST</p></div></div><button type="button" onClick={runTest} disabled={testing} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">{testing ? 'Running test…' : 'Run test'}</button>{testResult && <div className="rounded-lg bg-muted p-4 text-sm">{testResult}</div>}</div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-6 text-center py-8"><div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">✓</div><div><h2 className="text-2xl font-bold">You’re ready to go</h2><p className="text-muted-foreground mt-2 max-w-xl mx-auto">Your Mobiwave Payments setup has been recorded. Configure your live Daraja credentials in the server environment before enabling production traffic.</p></div><div className="grid md:grid-cols-3 gap-4 text-left"><Status title="Business profile" /><Status title="Payment methods" /><Status title="Webhook flow" /></div><Link href="/dashboard" className="inline-block px-6 py-3 rounded-lg bg-primary text-primary-foreground">Open payments dashboard</Link></section>
        )}

        {step < 4 && <div className="mt-8 pt-6 border-t border-border flex items-center justify-between"><button type="button" disabled={step === 0} onClick={() => setStep((current) => current - 1)} className="px-4 py-2 rounded-lg border border-border disabled:opacity-40">Back</button>{step < 3 ? <button type="button" onClick={next} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground">Continue</button> : <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">{saving ? 'Saving…' : 'Complete onboarding'}</button>}</div>}
        {saved && step === 4 && <p className="text-xs text-muted-foreground">Onboarding saved successfully.</p>}
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, required }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return <label className="block"><span className="block text-sm font-medium mb-2">{label}{required && <span className="text-red-500"> *</span>}</span><input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-border bg-background px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30" /></label>;
}

function Status({ title }: { title: string }) {
  return <div className="rounded-lg border border-border p-4"><div className="flex items-center gap-2"><span className="text-primary">✓</span><span className="font-medium">{title}</span></div><p className="text-xs text-muted-foreground mt-1">Configured</p></div>;
}
