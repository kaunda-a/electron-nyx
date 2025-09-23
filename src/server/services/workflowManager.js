const WorkflowEngine = require('./WorkflowEngine');
const logger = require('../utils/logger');

/**
 * Workflow Manager
 * Main interface for workflow operations
 */
class WorkflowManager {
  constructor() {
    this.engine = new WorkflowEngine({
      maxWorkers: 10,
      maxRetries: 3,
      retryDelay: 1000,
      enablePersistence: true
    });
    
    // Start the engine
    this.engine.start();
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners for workflow engine events
   */
  setupEventListeners() {
    this.engine.on('job.queued', (job) => {
      logger.info('Workflow job queued', {
        workflow: job.workflow,
        jobId: job.id
      });
    });
    
    this.engine.on('job.started', (job) => {
      logger.info('Workflow job started', {
        workflow: job.workflow,
        jobId: job.id
      });
    });
    
    this.engine.on('job.completed', (job) => {
      logger.info('Workflow job completed', {
        workflow: job.workflow,
        jobId: job.id,
        duration: job.completedAt ? 
          new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime() : 
          null
      });
    });
    
    this.engine.on('job.failed', (job) => {
      logger.error('Workflow job failed', {
        workflow: job.workflow,
        jobId: job.id,
        error: job.error
      });
    });
    
    this.engine.on('job.retrying', (job) => {
      logger.warn('Workflow job retrying', {
        workflow: job.workflow,
        jobId: job.id,
        attempt: job.attempt
      });
    });
    
    this.engine.on('job.cancelled', (job) => {
      logger.info('Workflow job cancelled', {
        workflow: job.workflow,
        jobId: job.id
      });
    });
    
    this.engine.on('step.started', (step) => {
      logger.debug('Workflow step started', {
        jobId: step.jobId,
        stepName: step.stepName
      });
    });
    
    this.engine.on('step.completed', (step) => {
      logger.debug('Workflow step completed', {
        jobId: step.jobId,
        stepName: step.stepName
      });
    });
    
    this.engine.on('step.failed', (step) => {
      logger.error('Workflow step failed', {
        jobId: step.jobId,
        stepName: step.stepName,
        error: step.error
      });
    });
  }
  
  /**
   * Register a workflow function
   * @param {string} name - Workflow name
   * @param {Function} fn - Workflow function
   * @param {Object} options - Workflow options
   */
  registerWorkflow(name, fn, options = {}) {
    return this.engine.registerWorkflow(name, fn, options);
  }
  
  /**
   * Trigger a workflow execution
   * @param {string} workflowName - Name of workflow to execute
   * @param {Object} data - Data to pass to workflow
   * @param {Object} options - Execution options
   */
  async trigger(workflowName, data = {}, options = {}) {
    return await this.engine.trigger(workflowName, data, options);
  }
  
  /**
   * Schedule a workflow for future execution
   * @param {string} workflowName - Name of workflow to schedule
   * @param {Object} data - Data to pass to workflow
   * @param {string|Date} schedule - Schedule time (cron expression or ISO date)
   * @param {Object} options - Schedule options
   */
  async schedule(workflowName, data = {}, schedule, options = {}) {
    return await this.engine.schedule(workflowName, data, schedule, options);
  }
  
  /**
   * Get job by ID
   * @param {string} jobId - Job ID
   */
  getJob(jobId) {
    return this.engine.getJob(jobId);
  }
  
  /**
   * Get all jobs
   */
  getAllJobs() {
    return this.engine.getAllJobs();
  }
  
  /**
   * Get workflow statistics
   */
  getStatistics() {
    return this.engine.getStatistics();
  }
  
  /**
   * Cancel a job
   * @param {string} jobId - Job ID to cancel
   */
  async cancelJob(jobId) {
    return await this.engine.cancelJob(jobId);
  }
  
  /**
   * Stop the workflow manager
   */
  async stop() {
    await this.engine.stop();
  }
}

// Export singleton instance
module.exports = new WorkflowManager();