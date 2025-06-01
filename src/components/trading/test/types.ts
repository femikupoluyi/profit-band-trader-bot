
export interface TestResult {
  test: string;
  status: 'running' | 'success' | 'error' | 'warning';
  message: string;
  orderId?: string;
}
