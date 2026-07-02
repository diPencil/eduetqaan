import { Component, inject, signal, computed, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { NavService, NavItem } from '../../../core/services/nav.service';
import { RouterModule, RouterLink, Router, NavigationEnd } from '@angular/router';
import { SocketService } from '../../../core/services/socket.service';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';
import { Subject, of } from 'rxjs';
import { filter, debounceTime, distinctUntilChanged, switchMap, map, catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, FormsModule, IconComponent],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  private authService = inject(AuthService);
  private navService = inject(NavService);
  private socketService = inject(SocketService);
  private router = inject(Router);
  private eRef = inject(ElementRef);
  private http = inject(HttpClient);
  
  currentUser = this.authService.currentUser;
  unreadNotifications = 0;

  currentGroupLabel = signal<string>('نظرة عامة');
  currentItemLabel = signal<string>('الرئيسية');

  searchQuery = signal<string>('');
  isSearchOpen = signal<boolean>(false);
  
  private searchSubject = new Subject<string>();
  studentResults = signal<any[]>([]);

  searchResults = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return [];
    
    let results: (NavItem & { group: string })[] = [];
    const role = this.currentUser()?.role;

    this.navService.navGroups.forEach(group => {
      const allowedItems = group.items.filter(item => !item.allowedRoles || (role && item.allowedRoles.includes(role as any)));
      const matched = allowedItems.filter(item => 
        item.label.toLowerCase().includes(query) || 
        group.groupName.toLowerCase().includes(query)
      );
      results = [...results, ...matched.map(m => ({ ...m, group: group.groupName }))];
    });

    return results.slice(0, 4);
  });

  constructor() {
    this.socketService.listen<{ title: string }>('notification').subscribe(() => {
      this.unreadNotifications++;
    });
    this.socketService.listen('new_payment').subscribe(() => {
      this.unreadNotifications++;
    });

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateBreadcrumbs(this.router.url);
      this.isSearchOpen.set(false);
      this.searchQuery.set('');
    });

    setTimeout(() => this.updateBreadcrumbs(this.router.url), 100);

    // Student Search API
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query) return of([]);
        return this.http.get<{success: boolean, data: any[]}>(`${environment.apiUrl}/students/admin?q=${encodeURIComponent(query)}`).pipe(
          map(res => res.success ? res.data.slice(0, 5) : []),
          catchError(() => of([]))
        );
      })
    ).subscribe(results => {
      this.studentResults.set(results);
    });
  }

  private updateBreadcrumbs(url: string) {
    let found = false;
    for (const group of this.navService.navGroups) {
      for (const item of group.items) {
        if (url.includes(item.route)) {
          this.currentGroupLabel.set(group.groupName);
          this.currentItemLabel.set(item.label);
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found && url === '/') {
       this.currentGroupLabel.set('نظرة عامة');
       this.currentItemLabel.set('الرئيسية');
    }
  }

  toggleSidebar() {
    this.navService.toggleSidebar();
  }

  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    const searchContainer = this.eRef.nativeElement.querySelector('.search-container');
    if (searchContainer && !searchContainer.contains(event.target as Node)) {
      this.isSearchOpen.set(false);
    }
  }

  onSearchFocus() {
    if (this.searchQuery().trim()) {
      this.isSearchOpen.set(true);
    }
  }

  onSearchInput() {
    const query = this.searchQuery().trim();
    this.isSearchOpen.set(query.length > 0);
    this.searchSubject.next(query);
    if (!query) {
      this.studentResults.set([]);
    }
  }

  navigateToResult(route: string) {
    this.router.navigateByUrl(route);
    this.isSearchOpen.set(false);
    this.searchQuery.set('');
  }
}
