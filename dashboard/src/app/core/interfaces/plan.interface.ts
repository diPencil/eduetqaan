export interface Plan {
  id?: number;
  name: string;
  description?: string;
  priceCents: number;
  currency: string;
  periodDays: number;
  isActive: boolean;
  scopeType: 'ALL' | 'CATEGORY' | 'GRADE' | 'COURSE_LIST' | 'LESSON_LIST';
  scopeValue?: string;
  scopeStage?: string;
  includeCourseIds?: string | number[];
  includeLessonIds?: string | number[];
}

export interface Subscription {
  id: number;
  studentId: number;
  studentName?: string;
  planId: number;
  planName?: string;
  priceCents: number;
  currency: string;
  startAt: string;
  endAt: string;
  status: 'active' | 'expired' | 'pending';
}
