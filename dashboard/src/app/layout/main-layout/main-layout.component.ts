import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { TabBarComponent } from '../../shared/components/tab-bar/tab-bar.component';
import { ToastContainerComponent } from '../../shared/components/toast/toast-container.component';
import { ConfirmModalComponent } from '../../shared/components/modal/confirm-modal.component';
import { AlertModalComponent } from '../../shared/components/modal/alert-modal.component';
import { NavService } from '../../core/services/nav.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, HeaderComponent, TabBarComponent, ToastContainerComponent, ConfirmModalComponent, AlertModalComponent],
  templateUrl: './main-layout.component.html',

  styles: [`
    :host { display: block; }
  `]
})
export class MainLayoutComponent {
  private navService = inject(NavService);
  isSidebarOpen = this.navService.isSidebarOpen;

  closeSidebar() {
    this.navService.closeSidebar();
  }
}
