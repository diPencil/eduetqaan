import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './search-input.component.html',
})
export class SearchInputComponent {
  @Input() placeholder: string = 'بحث...';
  @Input() value: string = '';
  
  @Output() valueChange = new EventEmitter<string>();
  @Output() search = new EventEmitter<string>();

  onValueChange(newValue: string) {
    this.value = newValue;
    this.valueChange.emit(this.value);
    this.search.emit(this.value);
  }

  clear() {
    this.value = '';
    this.valueChange.emit(this.value);
    this.search.emit(this.value);
  }
}
