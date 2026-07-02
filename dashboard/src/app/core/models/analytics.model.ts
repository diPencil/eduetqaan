export interface ChartDataset {
  label?: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string | string[];
  hoverBackgroundColor?: string | string[];
  fill?: boolean;
  tension?: number;
}

export interface ChartDataResponse {
  labels: string[];
  datasets: ChartDataset[];
}
