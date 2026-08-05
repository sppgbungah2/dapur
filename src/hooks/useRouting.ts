import { useState, useEffect } from 'react';
import { Division, UserRole, SOPDocument } from '../types';
import { UserProfile } from '../lib/supabase';
import { getLocalDateString } from '../lib/supabase';
import { 
  getSlugFromDivision, 
  getDivisionFromSlug, 
  formatDateToSlug, 
  parseDateFromSlug, 
  getPageFromTab, 
  getTabFromPage 
} from '../presetData';

export function useRouting(loggedInUser: UserProfile | null) {
  const [activeTab, setActiveTab] = useState<number>(23); // Default Dashboard
  const [selectedDate, setSelectedDateState] = useState<string>(() => {
    return getLocalDateString();
  });
  const [isDocumentDateSelected, setIsDocumentDateSelected] = useState(false);
  const setSelectedDate = (date: string) => {
    setSelectedDateState(date);
    setIsDocumentDateSelected(true);
  };
  const setSelectedMonth = (month: string) => {
    setSelectedDateState(`${month}-01`);
    setIsDocumentDateSelected(false);
  };
  const [activeSopDetail, setActiveSopDetail] = useState<SOPDocument | null>(null);

  // Synchronize route with URL pathname
  useEffect(() => {
    const handleRouteChange = () => {
      if (window.location.hash) {
        const hashPath = window.location.hash.replace(/^#\/?/, '/');
        window.history.replaceState(null, '', hashPath);
      }

      const path = window.location.pathname;
      if (!path || path === '/') return;

      const parts = path.split('/').filter(Boolean);

      // Dashboard month route: /dashboard-admin/2026Agustus[/23]
      if (parts[0] === 'dashboard-admin') {
        const monthMatch = (parts[1] || '').match(/^(\d{4})(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)$/i);
        if (monthMatch) {
          const monthNumber = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'].indexOf(monthMatch[2].toLowerCase()) + 1;
          const day = /^\d{1,2}$/.test(parts[2] || '') ? Number(parts[2]) : 1;
          setSelectedDateState(`${monthMatch[1]}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
          setIsDocumentDateSelected(day !== 1 || !!parts[2]);
        }
      }
      const monthRouteIndex = parts.findIndex(part => /^(\d{4})(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)$/i.test(part));
      if (monthRouteIndex >= 0 && parts[0] !== 'dashboard-admin') {
        const monthMatch = parts[monthRouteIndex].match(/^(\d{4})(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)$/i)!;
        const monthNumber = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'].indexOf(monthMatch[2].toLowerCase()) + 1;
        const day = /^\d{1,2}$/.test(parts[monthRouteIndex + 1] || '') ? Number(parts[monthRouteIndex + 1]) : 1;
        setSelectedDateState(`${monthMatch[1]}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        setIsDocumentDateSelected(day !== 1 || !!parts[monthRouteIndex + 1]);
      }

      // Check for Date Slug
      for (let i = parts.length - 1; i >= 0; i--) {
        const parsedDate = parseDateFromSlug(parts[i]);
        if (parsedDate) {
          setSelectedDateState(parsedDate);
          setIsDocumentDateSelected(true);
          break;
        }
      }

      // Check for Page Slug
      for (let i = 0; i < parts.length; i++) {
        const pageCandidate = parts[i].toLowerCase().trim();
        const tab = getTabFromPage(pageCandidate);
        if (tab !== 23 || pageCandidate === 'dashboard-admin' || pageCandidate === 'dashboard') {
          setActiveTab(tab);
          break;
        }
      }
    };

    window.addEventListener('popstate', handleRouteChange);
    handleRouteChange();

    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  // Update URL state
  useEffect(() => {
    if (!loggedInUser) return;

    let prefix = 'admin';
    let subEntity = '';

    const email = loggedInUser.email?.toLowerCase().trim() || '';
    if (email.includes('ma@qomaruddin.com')) { prefix = 'user'; subEntity = 'ma'; }
    else if (email.includes('smk@qomaruddin.com')) { prefix = 'user'; subEntity = 'smk'; }
    else if (email.includes('sma@qomaruddin.com')) { prefix = 'user'; subEntity = 'sma'; }
    else if (email.includes('mts@qomaruddin.com')) { prefix = 'user'; subEntity = 'mts'; }
    else if (email.includes('sukowati@qomaruddin.com')) { prefix = 'user'; subEntity = 'sukowati'; }
    else if (email.includes('sidokumpul@qomaruddin.com')) { prefix = 'user'; subEntity = 'sidokumpul'; }
    else if (loggedInUser.isCoordinator) {
      prefix = 'koordinator';
      if (loggedInUser.coordinatorDivision) {
        subEntity = getSlugFromDivision(loggedInUser.coordinatorDivision);
      }
    }
    else if (loggedInUser.role === UserRole.DRIVER) { prefix = 'driver'; }
    else if (loggedInUser.role === UserRole.CHEF) { prefix = 'chef'; }
    else if (loggedInUser.role === UserRole.AHLI_GIZI) { prefix = 'gizi'; }
    else if (loggedInUser.role === UserRole.ASLAP) { prefix = 'aslap'; }

    const page = getPageFromTab(activeTab);
    const dateSlug = formatDateToSlug(selectedDate);

    if (page) {
      let newPath = '';
      if (activeTab === 23) {
        const [year, month] = selectedDate.split('-');
        const monthName = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][Number(month) - 1];
        newPath = `/dashboard-admin/${year}${monthName}${isDocumentDateSelected ? `/${Number(selectedDate.slice(8, 10))}` : ''}`;
      } else if ([15, 19, 20, 21].includes(activeTab)) {
        const [year, month] = selectedDate.split('-');
        const monthName = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][Number(month) - 1];
        newPath = `/${page}/${year}${monthName}${isDocumentDateSelected ? `/${Number(selectedDate.slice(8, 10))}` : ''}`;
      } else if (activeTab === 15 && activeSopDetail) {
        const divSlug = getSlugFromDivision(activeSopDetail.division);
        if (subEntity) {
          newPath = `/${prefix}/${subEntity}/${page}/${divSlug}/${dateSlug}`;
        } else {
          newPath = `/${prefix}/${page}/${divSlug}/${dateSlug}`;
        }
      } else if (subEntity) {
        newPath = `/${prefix}/${subEntity}/${page}/${dateSlug}`;
      } else {
        newPath = `/${prefix}/${page}/${dateSlug}`;
      }

      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
    }
  }, [activeTab, selectedDate, activeSopDetail, loggedInUser, isDocumentDateSelected]);

  return {
    activeTab,
    setActiveTab,
    selectedDate,
    setSelectedDate,
    setSelectedMonth,
    activeSopDetail,
    setActiveSopDetail
  };
}
