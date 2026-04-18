// src/app/cancellation-policy/page.js
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Booking & Cancellation Policy | Oasis",
  description:
    "Read our booking, payment, and cancellation policies for Oasis bespoke experiences.",
};

export default function CancellationPolicyPage() {
  return (
    <main className="min-h-screen bg-[#fcf9f4] font-sans pb-32 selection:bg-[#8b6f47]/20">
      {/* Top Nav */}
      <div className="bg-white border-b border-[#e5e0d8] sticky top-0 z-30 shadow-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#5a4a3f] text-sm border border-[#e0dcd4] rounded-full px-4 py-2 hover:bg-[#f4f1ec] transition-all shadow-sm focus:ring-2 focus:ring-[#8b6f47]/40 outline-none"
          >
            <ArrowLeft size={16} /> Back to Home
          </Link>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#a09084]">
            <ShieldCheck size={16} className="text-[#8b6f47]" /> Legal
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-12 sm:pt-20">
        {/* Header */}
        <header className="mb-12 text-center sm:text-left border-b border-[#e0dcd4] pb-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b6f47] mb-3">
            Oasis Experiences
          </p>
          <h1 className="text-3xl sm:text-5xl font-serif text-[#3a2f28] leading-tight mb-6">
            Πολιτική Κρατήσεων & Ακυρώσεων
          </h1>
          <p className="text-[#7a6a5f] text-sm sm:text-base leading-relaxed max-w-2xl">
            Η Oasis προσφέρει εξατομικευμένες (bespoke) και private εμπειρίες.
            Λόγω της φύσης των υπηρεσιών μας, οι οποίες απαιτούν τον
            προγραμματισμό εξωτερικών συνεργατών (οδηγοί, τοπικοί τεχνίτες, σεφ)
            και την προμήθεια φρέσκων, τοπικών υλικών, εφαρμόζουμε την παρακάτω
            αυστηρή πολιτική κρατήσεων και ακυρώσεων.
          </p>
        </header>

        {/* Content */}
        <article className="prose prose-stone prose-sm sm:prose-base max-w-none text-[#5a4a3f]">
          {/* Section 1 */}
          <section className="mb-12">
            <h2 className="flex items-center gap-3 text-xl font-serif text-[#3a2f28] mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#fdfaf5] border border-[#e0dcd4] text-sm font-bold text-[#8b6f47]">
                1
              </span>
              Διαδικασία Κράτησης & Πληρωμών
            </h2>
            <ul className="space-y-4 list-none pl-0">
              <li className="relative pl-6">
                <span className="absolute left-0 top-2.5 w-2 h-2 rounded-full bg-[#8b6f47]"></span>
                <strong className="text-[#3a2f28]">Προπληρωμή:</strong> Για την
                επιβεβαίωση και οριστικοποίηση οποιασδήποτε κράτησης, απαιτείται
                η προπληρωμή του 100% του συνολικού κόστους της εμπειρίας. Χωρίς
                την ολοκλήρωση της πληρωμής, η ημερομηνία και η ώρα δεν
                δεσμεύονται.
              </li>
              <li className="relative pl-6">
                <span className="absolute left-0 top-2.5 w-2 h-2 rounded-full bg-[#8b6f47]"></span>
                <strong className="text-[#3a2f28]">Προθεσμία:</strong> Οι
                κρατήσεις πρέπει να ολοκληρώνονται το αργότερο 48 ώρες πριν από
                την προγραμματισμένη έναρξη της δραστηριότητας, ώστε να
                διασφαλιστεί η άρτια οργάνωση.
              </li>
              <li className="relative pl-6">
                <span className="absolute left-0 top-2.5 w-2 h-2 rounded-full bg-[#8b6f47]"></span>
                <strong className="text-[#3a2f28]">
                  Αλλεργίες & Ιδιαιτερότητες:
                </strong>{" "}
                Ο πελάτης οφείλει να δηλώσει γραπτώς (κατά την κράτηση) τυχόν
                τροφικές αλλεργίες ή ιατρικούς περιορισμούς. Η Oasis δεν φέρει
                ευθύνη εάν δεν έχει ενημερωθεί εγκαίρως.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="mb-12">
            <h2 className="flex items-center gap-3 text-xl font-serif text-[#3a2f28] mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#fdfaf5] border border-[#e0dcd4] text-sm font-bold text-[#8b6f47]">
                2
              </span>
              Πολιτική Ακύρωσης Από Τον Πελάτη
            </h2>
            <p className="mb-4">
              Κατανοούμε ότι τα σχέδια μπορεί να αλλάξουν. Σε περίπτωση που
              χρειαστεί να ακυρώσετε την εμπειρία σας, ισχύουν τα εξής:
            </p>
            <div className="bg-white border border-[#e0dcd4] rounded-2xl overflow-hidden shadow-sm">
              <ul className="divide-y divide-[#e0dcd4] list-none pl-0 my-0">
                <li className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#fdfcfb]">
                  <span className="font-medium text-[#3a2f28]">
                    Έως και 14 ημέρες πριν
                  </span>
                  <span className="inline-flex px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-bold tracking-wide">
                    100% Επιστροφή
                  </span>
                </li>
                <li className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="font-medium text-[#3a2f28]">
                    Από 7 έως 13 ημέρες πριν
                  </span>
                  <span className="inline-flex px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-bold tracking-wide">
                    50% Επιστροφή*
                  </span>
                </li>
                <li className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="font-medium text-[#3a2f28]">
                    Λιγότερο από 7 ημέρες (168 ώρες)
                  </span>
                  <span className="inline-flex px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-bold tracking-wide">
                    Καμία Επιστροφή
                  </span>
                </li>
                <li className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="font-medium text-[#3a2f28]">
                    Μη Εμφάνιση (No-Show)
                  </span>
                  <span className="inline-flex px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-bold tracking-wide">
                    Καμία Επιστροφή
                  </span>
                </li>
              </ul>
            </div>
            <p className="mt-4 text-xs text-[#7a6a5f]">
              * Το υπόλοιπο 50% παρακρατείται για την κάλυψη διαχειριστικών
              εξόδων και αμοιβών προετοιμασίας των συνεργατών. Σε περίπτωση
              No-Show στο προκαθορισμένο σημείο συνάντησης την ώρα της
              αναχώρησης, η κράτηση ακυρώνεται άμεσα.
            </p>
          </section>

          {/* Section 3 */}
          <section className="mb-12">
            <h2 className="flex items-center gap-3 text-xl font-serif text-[#3a2f28] mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#fdfaf5] border border-[#e0dcd4] text-sm font-bold text-[#8b6f47]">
                3
              </span>
              Αλλαγή Ημερομηνίας (Rescheduling)
            </h2>
            <ul className="space-y-4 list-none pl-0">
              <li className="relative pl-6">
                <span className="absolute left-0 top-2.5 w-2 h-2 rounded-full bg-[#8b6f47]"></span>
                Αιτήματα για αλλαγή ημερομηνίας γίνονται δεκτά έως και{" "}
                <strong>7 ημέρες</strong> πριν την αρχικά προγραμματισμένη
                εμπειρία, δωρεάν, και υπόκεινται πάντα στη διαθεσιμότητα της
                Oasis και των συνεργατών της.
              </li>
              <li className="relative pl-6">
                <span className="absolute left-0 top-2.5 w-2 h-2 rounded-full bg-[#8b6f47]"></span>
                Αιτήματα αλλαγής σε λιγότερο από 7 ημέρες θεωρούνται ακύρωση της
                αρχικής κράτησης και εμπίπτουν στην παραπάνω Πολιτική Ακυρώσεων.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="mb-12">
            <h2 className="flex items-center gap-3 text-xl font-serif text-[#3a2f28] mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#fdfaf5] border border-[#e0dcd4] text-sm font-bold text-[#8b6f47]">
                4
              </span>
              Ακύρωση Από Την Oasis & Ανωτέρα Βία
            </h2>
            <p className="mb-4">
              Η ασφάλεια και η ποιότητα της εμπειρίας των επισκεπτών μας είναι η
              απόλυτη προτεραιότητά μας.
            </p>
            <ul className="space-y-4 list-none pl-0">
              <li className="relative pl-6 border border-[#e0dcd4] bg-white p-5 rounded-2xl shadow-sm">
                <span className="absolute left-4 top-6 w-2 h-2 rounded-full bg-[#8b6f47]"></span>
                <strong className="text-[#3a2f28] block mb-1">
                  Καιρικές Συνθήκες:
                </strong>{" "}
                Ειδικά για τις outdoor δραστηριότητες (π.χ. The Zourva
                Awakening), η Oasis διατηρεί το αποκλειστικό δικαίωμα να
                ακυρώσει ή να τροποποιήσει την εμπειρία σε περίπτωση ακραίων ή
                επικίνδυνων καιρικών συνθηκών. Σε αυτή την περίπτωση,
                προσφέρεται 100% επιστροφή χρημάτων ή η δυνατότητα επιλογής νέας
                ημερομηνίας / εναλλακτικής εμπειρίας.
              </li>
              <li className="relative pl-6 border border-[#e0dcd4] bg-white p-5 rounded-2xl shadow-sm">
                <span className="absolute left-4 top-6 w-2 h-2 rounded-full bg-[#8b6f47]"></span>
                <strong className="text-[#3a2f28] block mb-1">
                  Ελάχιστος Αριθμός Συμμετεχόντων:
                </strong>{" "}
                Οι ομαδικές (Group) εμπειρίες απαιτούν έναν ελάχιστο αριθμό 4
                συμμετεχόντων. Αν αυτός ο αριθμός δεν συμπληρωθεί έως και 48
                ώρες πριν την έναρξη, η Oasis θα επικοινωνήσει με τους
                εγγεγραμμένους πελάτες για να προτείνει εναλλακτική ημερομηνία,
                αναβάθμιση σε private εμπειρία (με αντίστοιχη χρέωση) ή πλήρη
                επιστροφή χρημάτων.
              </li>
            </ul>
          </section>
        </article>
      </div>
    </main>
  );
}
