export interface DashboardStats {
  success: boolean;
  data: {
    kpis: Array<{
      label: string;
      value: any;
      icon: string;
      color: string;
    }>;
    recentActivity: Array<{
      kind: 'student' | 'checkout';
      text: string;
      time: string | null;
      icon: string;
      meta?: any;
    }>;
    centers: {
      totalCenters: number;
      studentsByCenter: any[];
    };
    attendance: {
      startOfMonth: string | null;
      attendanceThisMonth: number;
      uniqueStudentsThisMonth: number;
      attendanceByCenter: any[];
    };
    checkoutNotifications: {
      pendingCount: number;
      latest: any[];
    };
    studentPerformance?: {
      avgExamScore: number;
      examsCount: number;
      homeworksCount: number;
      lecturesCount: number;
      activeDays: number;
    };
  };
}
