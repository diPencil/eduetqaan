import { Component, Input, Output, EventEmitter, booleanAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchInputComponent } from '../search-input/search-input.component';

export interface FilterOption {
  value: string | number | null;
  label: string;
}

export interface FilterDefinition {
  key: string;
  label: string;
  options: FilterOption[];
  value: any;
  type?: 'select' | 'date';
}

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchInputComponent],
  templateUrl: './filter-bar.component.html',
})
export class FilterBarComponent {
  @Input({ transform: booleanAttribute }) showSearch = true;
  @Input() searchPlaceholder = 'بحث...';
  @Input() filters: FilterDefinition[] = [];
  
  @Output() search = new EventEmitter<string>();
  @Output() filterChange = new EventEmitter<Record<string, any>>();

  onSearch(term: string) {
    this.search.emit(term);
  }

  onFilterChange() {
    const filterValues: Record<string, any> = {};
    this.filters.forEach(f => {
      if (f.value !== null && f.value !== '') {
        filterValues[f.key] = f.value;
      }
    });
    this.filterChange.emit(filterValues);
  }
}
