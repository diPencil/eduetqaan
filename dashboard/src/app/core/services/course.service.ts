import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Course {
  id: number;
  title: string;
  slug: string;
  shortDesc?: string;
  longDesc?: string;
  coverImageUrl?: string;
  teacherName?: string;
  category?: string;
  level: string;
  isFree: boolean;
  priceCents: number;
  status: 'draft' | 'published' | 'archived';
  lessonsCount: number;
  lessons?: any[];
  publishedAt?: string;
}

export interface CoursesResponse {
  success: boolean;
  data: Course[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CourseService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:12011/api/v1';

  getCourses(params?: any): Observable<CoursesResponse> {
    return this.http.get<CoursesResponse>(`${this.apiUrl}/courses`, { params });
  }

  getCourse(id: number): Observable<{ success: boolean; data: Course }> {
    return this.http.get<{ success: boolean; data: Course }>(`${this.apiUrl}/courses/${id}`);
  }

  getCourseWithLessons(id: number): Observable<{ success: boolean; data: Course & { lessons: any[] } }> {
    return this.http.get<{ success: boolean; data: Course & { lessons: any[] } }>(`${this.apiUrl}/courses/${id}`);
  }

  createCourse(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/courses`, data);
  }

  updateCourse(id: number, data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/courses/${id}`, data);
  }

  deleteCourse(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/courses/${id}`);
  }

  publishCourse(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/courses/${id}/publish`, {});
  }

  unpublishCourse(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/courses/${id}/unpublish`, {});
  }

  // === Lessons CRUD ===
  createLesson(courseId: number, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/courses/${courseId}/lessons`, data);
  }

  updateLesson(courseId: number, lessonId: number, data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/courses/${courseId}/lessons/${lessonId}`, data);
  }

  deleteLesson(courseId: number, lessonId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/courses/${courseId}/lessons/${lessonId}`);
  }
}
