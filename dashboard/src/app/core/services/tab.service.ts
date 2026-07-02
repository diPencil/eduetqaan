import { Injectable, inject, signal } from '@angular/core';
import { Router, NavigationEnd, Event } from '@angular/router';
import { filter } from 'rxjs';
import { moveItemInArray } from '@angular/cdk/drag-drop';
import { TabRouteReuseStrategy } from '../strategies/tab-route-reuse.strategy';

export interface AppTab {
  url: string;
  title: string;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TabService {
  private router = inject(Router);
  
  // Manage tabs using Angular Signals for easy reactivity in components
  tabs = signal<AppTab[]>([]);
  maxTabs = 10;

  constructor() {
    this.listenToRouteChanges();
  }

  private listenToRouteChanges() {
    this.router.events.pipe(
      filter((event: Event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.handleNavigation(event.urlAfterRedirects);
    });
  }

  private handleNavigation(url: string) {
    // Ignore root or auth routes if needed
    if (url === '/' || url.startsWith('/auth')) {
      return;
    }

    // Strip query params or fragments for clean URL tracking (optional, but good for uniqueness)
    const cleanUrl = url.split('?')[0].split('#')[0];

    const currentTabs = this.tabs();
    const existingTabIndex = currentTabs.findIndex(t => t.url === cleanUrl);

    if (existingTabIndex > -1) {
      // Tab exists, just make it active and deactivate others
      const updatedTabs = currentTabs.map((t, index) => ({
        ...t,
        isActive: index === existingTabIndex
      }));
      this.tabs.set(updatedTabs);
    } else {
      // New tab
      if (currentTabs.length >= this.maxTabs) {
        // Option 1: Don't allow more tabs
        // Option 2: Remove oldest unactive tab. We'll do Option 2: remove first non-active.
        const firstNonActive = currentTabs.findIndex(t => !t.isActive);
        if (firstNonActive > -1) {
          currentTabs.splice(firstNonActive, 1);
        }
      }

      const newTab: AppTab = {
        url: cleanUrl,
        title: this.generateTitleFromUrl(cleanUrl),
        isActive: true
      };

      const updatedTabs = currentTabs.map(t => ({ ...t, isActive: false }));
      updatedTabs.push(newTab);
      this.tabs.set(updatedTabs);
    }
  }

  closeTab(url: string, event?: MouseEvent) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const currentTabs = this.tabs();
    const tabIndex = currentTabs.findIndex(t => t.url === url);
    
    if (tabIndex === -1) return;

    const tabToClose = currentTabs[tabIndex];
    const newTabs = currentTabs.filter(t => t.url !== url);

    this.tabs.set(newTabs);
    
    // Destroy the component in memory to avoid memory leaks
    TabRouteReuseStrategy.deleteHandle(url);

    // If we closed the active tab, navigate to the adjacent one
    if (tabToClose.isActive) {
      if (newTabs.length > 0) {
        // Go to the tab immediately to the left, or right if it was the first tab
        const nextTabIndex = tabIndex >= newTabs.length ? newTabs.length - 1 : tabIndex;
        this.router.navigateByUrl(newTabs[nextTabIndex].url);
      } else {
        // No tabs left, navigate to a default dashboard route
        this.router.navigateByUrl('/dashboard');
      }
    }
  }

  reorderTabs(previousIndex: number, currentIndex: number) {
    const currentTabs = [...this.tabs()];
    moveItemInArray(currentTabs, previousIndex, currentIndex);
    this.tabs.set(currentTabs);
  }

  private generateTitleFromUrl(url: string): string {
    const segments = url.split('/').filter(s => s.length > 0);
    if (segments.length === 0) return 'الرئيسية';
    
    // Custom mappings for known Arabic titles
    const titleMap: Record<string, string> = {
      'dashboard': 'لوحة القيادة',
      'students': 'الطلاب',
      'courses': 'الكورسات',
      'exams': 'الامتحانات',
      'question-bank': 'بنك الأسئلة',
      'live-requests': 'طلبات البث',
      'center': 'السنتر',
      'attendance': 'الحضور',
      'roster': 'سجل الحضور',
      'games': 'الألعاب',
      'wallets': 'المحافظ',
      'vouchers': 'الكوبونات',
      'centers': 'السناتر',
      'qr-management': 'إدارة الـ QR',
      'certificates': 'الشهادات',
      'users': 'المستخدمين',
      'audit-logs': 'سجل النظام',
      'whatsapp': 'واتساب',
      'notifications': 'الإشعارات',
      'plans': 'الباقات',
      'subscriptions': 'الاشتراكات',
      'self-quiz': 'الاختبار الذاتي',
      'community': 'المجتمع',
      'cms': 'المحتوى',
      'faq': 'الأسئلة الشائعة',
      'maps': 'الخرائط',
      'sync-center': 'المزامنة'
    };

    const lastSegment = segments[segments.length - 1];
    
    // If last segment is a number (ID), combine it with the previous segment
    if (!isNaN(Number(lastSegment)) && segments.length > 1) {
      const prevSegment = segments[segments.length - 2];
      const prevTitle = titleMap[prevSegment] || this.capitalize(prevSegment);
      return `${prevTitle} #${lastSegment}`;
    }

    return titleMap[lastSegment] || this.capitalize(lastSegment);
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
  }
}
