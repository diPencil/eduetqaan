import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TabService, AppTab } from '../../../core/services/tab.service';
import { IconComponent } from '../icon/icon.component';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent, DragDropModule],
  template: `
    <div class="flex items-center w-full h-14 bg-slate-50/90 backdrop-blur-xl border-b border-slate-200/80 overflow-x-auto px-4 space-x-2 space-x-reverse scrollbar-hide shrink-0 z-10 sticky top-0 shadow-sm transition-all duration-300">
      
      <!-- Home Pinned Tab (Optional visual anchor) -->
      <div 
        (click)="navigate('/dashboard')"
        class="flex items-center justify-center min-w-[40px] h-9 rounded-lg cursor-pointer transition-all duration-300 hover:bg-slate-200/50 text-slate-500 hover:text-slate-800 ml-2 border border-transparent"
        title="الرئيسية"
      >
        <app-icon name="home" [size]="16"></app-icon>
      </div>

      <div class="h-5 w-px bg-slate-300/60 ml-2 rounded-full"></div>

      <!-- Dynamic Tabs -->
      <div 
        cdkDropList 
        cdkDropListOrientation="horizontal" 
        (cdkDropListDropped)="drop($event)"
        class="flex items-center space-x-2 space-x-reverse"
      >
        <div 
          *ngFor="let tab of tabs()" 
          cdkDrag
          cdkDragLockAxis="x"
          (click)="navigate(tab.url)"
          [class.active-tab]="tab.isActive"
          [class.inactive-tab]="!tab.isActive"
          class="group flex items-center min-w-[140px] max-w-[220px] h-9 px-3 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-300 select-none relative overflow-hidden transform origin-bottom border"
          title="{{ tab.title }}"
        >
          <!-- Active Indicator Line (Top) -->
        <div *ngIf="tab.isActive" class="absolute top-0 left-3 right-3 h-[2px] bg-gradient-to-r from-indigo-500 to-blue-500 rounded-b-md shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>

        <!-- Animated Background for Hover -->
        <div class="absolute inset-0 bg-gradient-to-br from-slate-100/50 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

        <div class="flex items-center justify-center w-5 h-5 rounded-md bg-slate-100/50 text-slate-400 group-hover:text-indigo-400 transition-colors ml-2" *ngIf="!tab.isActive">
          <app-icon name="file-text" [size]="12"></app-icon>
        </div>
        <div class="flex items-center justify-center w-5 h-5 rounded-md bg-indigo-50 text-indigo-500 ml-2" *ngIf="tab.isActive">
          <app-icon name="check-circle" [size]="12"></app-icon>
        </div>

        <span class="truncate text-[13px] tracking-wide flex-1 relative z-10 transition-colors duration-200" 
              [class.font-semibold]="tab.isActive" 
              [class.text-indigo-900]="tab.isActive"
              [class.text-slate-600]="!tab.isActive">
          {{ tab.title }}
        </span>
        
        <button 
          (click)="closeTab(tab.url, $event)"
          class="flex items-center justify-center w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 hover:bg-red-50 hover:text-red-600 text-slate-400 focus:opacity-100 relative z-10 mr-1"
          [class.opacity-100]="tab.isActive"
          [class.scale-100]="tab.isActive"
          title="إغلاق التبويب"
        >
          <app-icon name="x" [size]="14"></app-icon>
        </button>
        
        <!-- Drag Placeholder -->
        <div *cdkDragPlaceholder class="h-9 rounded-lg bg-slate-200/50 border border-dashed border-slate-300 min-w-[140px]"></div>
      </div>
    </div>
    </div>
  `,
  styles: [`
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }
    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
    
    .active-tab {
      background-color: #ffffff;
      border-color: #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
      transform: translateY(-1px);
    }
    
    .inactive-tab {
      background-color: transparent;
      border-color: transparent;
    }
    
    .inactive-tab:hover {
      background-color: rgba(241, 245, 249, 0.7);
      border-color: rgba(226, 232, 240, 0.5);
    }
    
    /* Drag & Drop Styles */
    .cdk-drag-preview {
      box-sizing: border-box;
      border-radius: 0.5rem;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      background-color: white;
      border: 1px solid #e2e8f0;
      opacity: 0.9;
      cursor: grabbing;
      display: flex;
      align-items: center;
      padding: 0 0.75rem;
    }
    
    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
    
    .cdk-drop-list-dragging .group {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
  `]
})
export class TabBarComponent {
  private tabService = inject(TabService);
  private router = inject(Router);

  tabs = this.tabService.tabs;

  drop(event: CdkDragDrop<AppTab[]>) {
    this.tabService.reorderTabs(event.previousIndex, event.currentIndex);
  }

  navigate(url: string) {
    this.router.navigateByUrl(url);
  }

  closeTab(url: string, event: MouseEvent) {
    this.tabService.closeTab(url, event);
  }
}
