'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReCAPTCHA from 'react-google-recaptcha';
import { createSupabaseBrowser } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createSupabaseBrowser();
  const router = useRouter();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const recaptchaRef = useRef(null);

  // If already signed in, bounce to dashboard
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (data.user) router.replace('/dashboard');
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      if (session?.user) router.replace('/dashboard');
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [router, supabase]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleRecaptchaChange = (token) => setRecaptchaToken(token);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    // Require reCAPTCHA
    if (!recaptchaToken) {
      setSubmitting(false);
      return setError('Please complete the reCAPTCHA.');
    }

    // (Optional but recommended) Verify reCAPTCHA on the server
    try {
      const verify = await fetch('/api/recaptcha/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: recaptchaToken }),
      }).then((r) => r.json());

      if (!verify?.ok) {
        setSubmitting(false);
        if (recaptchaRef.current) recaptchaRef.current.reset();
        return setError('reCAPTCHA verification failed. Please try again.');
      }
    } catch {
      // If the verify route is missing or errors, fail closed
      setSubmitting(false);
      if (recaptchaRef.current) recaptchaRef.current.reset();
      return setError('Could not verify reCAPTCHA. Please try again.');
    }

    // Supabase email/password sign-in
    const email = form.email.trim().toLowerCase();
    const password = form.password;

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setSubmitting(false);

    if (signInError) {
      setError(signInError.message || 'Invalid email or password.');
      if (recaptchaRef.current) recaptchaRef.current.reset();
      return;
    }

    router.replace('/dashboard');
  }

  if (authLoading) return <p className="p-6">Loading…</p>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f1ec] px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md">
        <h2 className="text-3xl font-serif text-[#5a4a3f] mb-6 text-center">Welcome Back</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block mb-1 text-sm text-[#5a4a3f]">Email</label>
            <input
              type="email"
              name="email"
              required
              value={form.email}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-md border border-[#e0dcd4] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm text-[#5a4a3f]">Password</label>
            <input
              type="password"
              name="password"
              required
              value={form.password}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-md border border-[#e0dcd4] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
            />
          </div>

          <div className="flex justify-center">
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
              onChange={handleRecaptchaChange}
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            className="w-full bg-[#8b6f47] text-white py-2 rounded-full font-medium hover:bg-[#a78b62] transition-all"
            disabled={submitting}
          >
            {submitting ? 'Logging In…' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-[#5a4a3f]">
            Don&apos;t have an account?{' '}
            <button onClick={() => router.push('/sign-up')} className="text-[#8b6f47] underline">
              Register
            </button>
          </p>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => router.push('/forgot-password')}
            className="text-sm text-[#8b6f47] hover:underline"
          >
            Forgot your password?
          </button>
        </div>
      </div>
    </div>
  );
}
