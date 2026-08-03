import { useState, useEffect } from 'react';
import { Division, UserRole, SOPDocument } from '../types';
import { UserProfile } from '../lib/supabase';
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
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
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

      // Check for Date Slug
      for (let i = parts.length - 1; i >= 0; i--) {
        const parsedDate = parseDateFromSlug(parts[i]);
        if (parsedDate) {
          setSelectedDate(parsedDate);
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
      if (activeTab === 15 && activeSopDetail) {
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
  }, [activeTab, selectedDate, activeSopDetail, loggedInUser]);

  return {
    activeTab,
    setActiveTab,
    selectedDate,
    setSelectedDate,
    activeSopDetail,
    setActiveSopDetail
  };
}
