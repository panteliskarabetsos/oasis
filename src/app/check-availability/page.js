'use client';

import { ArrowLeft } from 'lucide-react';
import UnderConstruction from '../under-construction/page';
import LinkWithLoader from '../components/LinkWithLoader';

export default function CheckAvailability() {
    
<UnderConstruction></UnderConstruction>
return (
    
    <div className="min-h-screen bg-[#f4f1ec] pt-28 px-6 text-[#2f2f2f]">
      <div className="max-w-4xl mx-auto ">
      <LinkWithLoader href="/experiences">
          <button className="flex items-center text-[#8b6f47] text-sm border border-[#8b6f47] rounded-full px-4 py-2 hover:bg-[#f4f1ec] hover:text-[#5a4a3f] transition-all">
            <ArrowLeft size={18} className="mr-2" />
            Back to Experiences
          </button>
        </LinkWithLoader>
      </div>
      <UnderConstruction></UnderConstruction>
    </div>
  );
}
