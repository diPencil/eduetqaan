import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pagination.component.html',
})
export class PaginationComponent {
  @Input() page: number = 1;
  @Input() totalPages: number = 1;
  @Input() total: number = 0;
  
  @Output() pageChange = new EventEmitter<number>();

  onPageChange(newPage: number) {
    if (newPage >= 1 && newPage <= this.totalPages && newPage !== this.page) {
      this.pageChange.emit(newPage);
    }
  }
}
