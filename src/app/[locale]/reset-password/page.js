import { Suspense } from 'react';
import ResetPasswordForm from './ResetPasswordForm';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center mt-20 text-[#5a4a3f]">Loading form...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
