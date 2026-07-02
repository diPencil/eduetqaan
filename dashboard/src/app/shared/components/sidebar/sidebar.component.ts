import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NavService, UserRole } from '../../../core/services/nav.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './sidebar.component.html',

  styles: [`
    :host { display: block; height: 100%; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
  `]
})
export class SidebarComponent {
  private authService = inject(AuthService);
  private navService = inject(NavService);
  
  currentUserRole = computed(() => this.authService.currentUser()?.role);

  navGroups = this.navService.navGroups;

  filteredNavGroups = computed(() => {
    const role = this.currentUserRole();
    if (!role) return [];

    return this.navGroups.map(group => ({
      ...group,
      items: group.items.filter(item => !item.allowedRoles || item.allowedRoles.includes(role as UserRole))
    })).filter(group => group.items.length > 0);
  });

  expandedGroups = signal<Record<string, boolean>>({});
  private router = inject(Router);

  constructor() {
    // Auto-expand the group that contains the current active route
    this.router.events.subscribe((event: any) => {
      if (event && event.url) {
        this.expandGroupForRoute(this.router.url);
      }
    });
    // Initial check
    setTimeout(() => this.expandGroupForRoute(this.router.url), 100);
  }

  toggleGroup(groupName: string) {
    this.expandedGroups.update((groups: Record<string, boolean>) => {
      const isExpanded = groups[groupName] !== false; // Default true
      return { ...groups, [groupName]: !isExpanded };
    });
  }

  isGroupExpanded(groupName: string): boolean {
    // Default to true if not explicitly collapsed
    return this.expandedGroups()[groupName] !== false;
  }

  expandGroupForRoute(url: string) {
    const newGroups = { ...this.expandedGroups() };
    let foundActive = false;
    
    this.navGroups.forEach(group => {
      const hasActiveRoute = group.items.some(item => url.includes(item.route));
      if (hasActiveRoute) {
        newGroups[group.groupName] = true;
        foundActive = true;
      }
    });

    if (foundActive) {
      this.navGroups.forEach(group => {
        const hasActiveRoute = group.items.some(item => url.includes(item.route));
        if (!hasActiveRoute) {
          newGroups[group.groupName] = false;
        }
      });
    }

    this.expandedGroups.set(newGroups);
  }

  getRoleLabel(role?: string) {
    switch (role) {
      case 'admin': return 'مدير النظام';
      case 'supervisor': return 'مشرف عام';
      case 'center_manager': return 'مشرف سنتر';
      case 'support': return 'دعم فني';
      default: return role || 'مستخدم';
    }
  }

  logout() {
    this.authService.logout();
  }

  closeSidebar() {
    this.navService.closeSidebar();
  }

  onRightClick(event: MouseEvent, route: string) {
    event.preventDefault();
    const win = window as any;
    if (win.require) {
      try {
        const electron = win.require('electron');
        electron.ipcRenderer.send('show-sidebar-context-menu', route);
      } catch (e) {
        console.error('Electron IPC not available', e);
      }
    }
  }
}

