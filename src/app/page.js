// src/app/page.js
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/en'); // default to English locale
}
