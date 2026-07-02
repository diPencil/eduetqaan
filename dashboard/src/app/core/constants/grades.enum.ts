export enum Grade {
  FIRST_YEAR = 'الصف الاول الثانوي',
  SECOND_YEAR = 'الصف الثاني الثانوي',
  THIRD_YEAR = 'الصف الثالث الثانوي'
}

export const GRADE_LABELS: Record<Grade, string> = {
  [Grade.FIRST_YEAR]: 'الصف الأول الثانوي',
  [Grade.SECOND_YEAR]: 'الصف الثاني الثانوي',
  [Grade.THIRD_YEAR]: 'الصف الثالث الثانوي'
};
