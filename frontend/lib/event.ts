/**
 * Event system for cross-component communication
 */

export const ReportEvents = {
    STARTED: 'report:started',
    COMPLETED: 'report:completed',
    FAILED: 'report:failed',
  } as const;
  
  export interface ReportEventDetail {
    jobId: string;
    timestamp: number;
    status?: string;
    error?: string;
  }
  
  /**
   * Emit when an analysis starts
   */
  export function emitReportStarted(jobId: string) {
    const event = new CustomEvent(ReportEvents.STARTED, {
      detail: { jobId, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
  }
  
  /**
   * Emit when an analysis completes successfully
   */
  export function emitReportCompleted(jobId: string) {
    const event = new CustomEvent(ReportEvents.COMPLETED, {
      detail: { jobId, timestamp: Date.now(), status: 'completed' }
    });
    window.dispatchEvent(event);
  }
  
  /**
   * Emit when an analysis fails
   */
  export function emitReportFailed(jobId: string, error?: string) {
    const event = new CustomEvent(ReportEvents.FAILED, {
      detail: { jobId, timestamp: Date.now(), status: 'failed', error }
    });
    window.dispatchEvent(event);
  }
  
  