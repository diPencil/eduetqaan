import { Component, Input, Output, EventEmitter, ContentChild, TemplateRef, booleanAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaginationComponent } from '../pagination/pagination.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [CommonModule, PaginationComponent, EmptyStateComponent],
  templateUrl: './table.component.html',
})
export class TableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  @Input() loading = false;
  @Input() title = '';
  @Input({ transform: booleanAttribute }) hasHeaderContent = false;
  
  // Empty State Props
  @Input() emptyIcon = 'folder';
  @Input() emptyTitle = 'لا توجد بيانات';
  @Input() emptyDescription = 'لم يتم العثور على سجلات تطابق بحثك.';

  // Pagination Props
  @Input({ transform: booleanAttribute }) showPagination = true;
  @Input() page = 1;
  @Input() limit = 10;
  @Input() total = 0;
  
  get totalPages(): number {
    return Math.ceil(this.total / this.limit) || 1;
  }

  @Output() pageChange = new EventEmitter<number>();
  @Output() sort = new EventEmitter<string>();

  @ContentChild('rowTemplate') rowTemplate!: TemplateRef<any>;
}
