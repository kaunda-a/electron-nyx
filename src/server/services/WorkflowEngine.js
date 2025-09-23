const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Advanced Workflow Engine
 * Custom workflow engine tailored for crawler bot operations
 */
class WorkflowEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      maxWorkers: options.maxWorkers || 10,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      enablePersistence: options.enablePersistence !== false,
      persistencePath: options.persistencePath || './localStorage/workflows',
      ...options
    };
    
    // Core components
    this.workflows = new Map();        // Registered workflows
    this.jobs = new Map();             // Active jobs
    this.jobQueue = [];                // Job queue
    this.workers = [];                 // Worker pool
    this.scheduledJobs = new Map();    // Scheduled jobs
    this.running = false;              // Engine state
    
    // Statistics
    this.stats = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      activeWorkers: 0,
      queueLength: 0
    };
    
    // Initialize if persistence is enabled
    if (this.options.enablePersistence) {
      this.initializePersistence();
    }
  }
  
  /**
   * Initialize persistence for workflow state
   */
  async initializePersistence() {
    try {
      const fs = require('fs-extra');
      const path = require('path');
      
      // Ensure persistence directory exists
      await fs.ensureDir(this.options.persistencePath);
      
      // Load existing workflow state
      await this.loadWorkflowState();
      
      logger.info('Workflow engine persistence initialized', {
        path: this.options.persistencePath
      });
    } catch (error) {
      logger.error('Failed to initialize workflow persistence', { error: error.message });
    }
  }
  
  /**
   * Load workflow state from persistence
   */
  async loadWorkflowState() {
    try {
      const fs = require('fs-extra');
      const path = require('path');
      
      const stateFile = path.join(this.options.persistencePath, 'workflow-state.json');
      if (await fs.pathExists(stateFile)) {
        const state = await fs.readJson(stateFile);
        // Load workflow metadata, but note that functions can't be persisted
        // Workflows must be re-registered on each startup
        for (const [name, workflowData] of Object.entries(state.workflows || {})) {
          this.workflows.set(name, {
            name: workflowData.name,
            // Note: No 'fn' property as functions can't be persisted
            options: workflowData.options,
            registeredAt: workflowData.registeredAt
          });
        }
        logger.info('Workflow state loaded from persistence');
      }
    } catch (error) {
      logger.error('Failed to load workflow state', { error: error.message });
    }
  }
  
  /**
   * Save workflow state to persistence
   * Note: Only save workflow metadata, not the functions themselves as they can't be serialized
   */
  async saveWorkflowState() {
    if (!this.options.enablePersistence) return;
    
    try {
      const fs = require('fs-extra');
      const path = require('path');
      
      const stateFile = path.join(this.options.persistencePath, 'workflow-state.json');
      // Only save workflow metadata, not functions which can't be serialized
      const workflowMetadata = {};
      for (const [name, workflow] of this.workflows) {
        workflowMetadata[name] = {
          name: workflow.name,
          options: workflow.options,
          registeredAt: workflow.registeredAt
          // Note: Not saving the 'fn' property as functions can't be serialized to JSON
        };
      }
      
      const state = {
        workflows: workflowMetadata,
        timestamp: new Date().toISOString()
      };
      
      await fs.writeJson(stateFile, state, { spaces: 2 });
    } catch (error) {
      logger.error('Failed to save workflow state', { error: error.message });
    }
  }
  
  /**
   * Register a workflow function
   * @param {string} name - Workflow name
   * @param {Function} fn - Workflow function
   * @param {Object} options - Workflow options
   */
  registerWorkflow(name, fn, options = {}) {
    if (typeof fn !== 'function') {
      throw new Error('Workflow must be a function');
    }
    
    this.workflows.set(name, {
      name,
      fn,
      options,
      registeredAt: new Date().toISOString()
    });
    
    logger.info(`Workflow registered: ${name}`);
    
    // Save state if persistence is enabled
    if (this.options.enablePersistence) {
      this.saveWorkflowState();
    }
    
    return this;
  }
  
  /**
   * Trigger a workflow execution
   * @param {string} workflowName - Name of workflow to execute
   * @param {Object} data - Data to pass to workflow
   * @param {Object} options - Execution options
   */
  async trigger(workflowName, data = {}, options = {}) {
    const workflow = this.workflows.get(workflowName);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowName}`);
    }
    
    // Check if workflow has a function (it might have been loaded from persistence without one)
    if (typeof workflow.fn !== 'function') {
      throw new Error(`Workflow function not available for: ${workflowName}. Workflows must be registered with a function.`);
    }
    
    const jobId = options.jobId || uuidv4();
    const job = {
      id: jobId,
      workflow: workflowName,
      data,
      options,
      status: 'queued',
      attempt: 1,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null
    };
    
    // Add to jobs map
    this.jobs.set(jobId, job);
    this.stats.totalJobs++;
    
    // Add to queue
    this.jobQueue.push(job);
    this.stats.queueLength = this.jobQueue.length;
    
    logger.info(`Workflow job queued: ${workflowName}`, { jobId });
    
    // Emit event
    this.emit('job.queued', job);
    
    // Start processing if not already running
    if (!this.running) {
      this.start();
    }
    
    return jobId;
  }
  
  /**
   * Schedule a workflow for future execution
   * @param {string} workflowName - Name of workflow to schedule
   * @param {Object} data - Data to pass to workflow
   * @param {string|Date} schedule - Schedule time (cron expression or ISO date)
   * @param {Object} options - Schedule options
   */
  async schedule(workflowName, data = {}, schedule, options = {}) {
    if (!schedule) {
      throw new Error('Schedule time is required');
    }
    
    const scheduleId = options.scheduleId || uuidv4();
    
    // Parse schedule
    let scheduleTime;
    if (typeof schedule === 'string' && schedule.includes('*')) {
      // Cron expression - parse it
      scheduleTime = this.parseCronExpression(schedule);
    } else if (typeof schedule === 'string') {
      // ISO date string
      scheduleTime = new Date(schedule);
    } else if (schedule instanceof Date) {
      // Date object
      scheduleTime = schedule;
    } else {
      throw new Error('Invalid schedule format');
    }
    
    const scheduledJob = {
      id: scheduleId,
      workflow: workflowName,
      data,
      schedule: scheduleTime,
      options,
      createdAt: new Date().toISOString()
    };
    
    this.scheduledJobs.set(scheduleId, scheduledJob);
    
    logger.info(`Workflow scheduled: ${workflowName}`, { 
      scheduleId, 
      scheduleTime: scheduleTime.toISOString() 
    });
    
    // Emit event
    this.emit('job.scheduled', scheduledJob);
    
    return scheduleId;
  }
  
  /**
   * Parse cron expression (simplified version)
   * @param {string} cron - Cron expression
   */
  parseCronExpression(cron) {
    // Simplified cron parser for common patterns
    // Format: "0 * * * *" (minute hour day month weekday)
    
    const now = new Date();
    const parts = cron.split(' ');
    
    if (parts.length !== 5) {
      throw new Error('Invalid cron expression format');
    }
    
    const [minute, hour, day, month, weekday] = parts;
    
    // For now, just handle simple patterns
    if (cron === '0 * * * *') {
      // Every hour
      return new Date(now.getTime() + 60 * 60 * 1000);
    } else if (cron === '0 0 * * *') {
      // Every day at midnight
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    } else if (cron === '0 0 * * 0') {
      // Every Sunday at midnight
      const nextSunday = new Date(now);
      nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()));
      nextSunday.setHours(0, 0, 0, 0);
      return nextSunday;
    }
    
    // Default to next minute
    return new Date(now.getTime() + 60 * 1000);
  }
  
  /**
   * Start the workflow engine
   */
  start() {
    if (this.running) return;
    
    this.running = true;
    logger.info('Workflow engine started');
    
    // Start worker pool
    this.startWorkers();
    
    // Start scheduler
    this.startScheduler();
    
    // Emit event
    this.emit('engine.started');
  }
  
  /**
   * Start worker pool
   */
  startWorkers() {
    // Create worker pool
    for (let i = 0; i < this.options.maxWorkers; i++) {
      const worker = {
        id: i,
        busy: false,
        currentJob: null
      };
      this.workers.push(worker);
    }
    
    logger.info(`Started ${this.options.maxWorkers} workflow workers`);
    
    // Start processing loop
    this.processLoop();
  }
  
  /**
   * Start scheduler for periodic tasks
   */
  startScheduler() {
    // Check for scheduled jobs every minute
    setInterval(() => {
      this.checkScheduledJobs();
    }, 60 * 1000);
    
    // Initial check
    setTimeout(() => {
      this.checkScheduledJobs();
    }, 1000);
  }
  
  /**
   * Check for scheduled jobs that are ready to run
   */
  async checkScheduledJobs() {
    const now = new Date();
    const readyJobs = [];
    
    // Find scheduled jobs that are ready to run
    for (const [id, scheduledJob] of this.scheduledJobs) {
      if (scheduledJob.schedule <= now) {
        readyJobs.push(scheduledJob);
        this.scheduledJobs.delete(id);
      }
    }
    
    // Trigger ready jobs
    for (const scheduledJob of readyJobs) {
      try {
        await this.trigger(
          scheduledJob.workflow,
          scheduledJob.data,
          scheduledJob.options
        );
        
        logger.info(`Scheduled job triggered: ${scheduledJob.workflow}`, {
          scheduleId: scheduledJob.id
        });
      } catch (error) {
        logger.error('Failed to trigger scheduled job', {
          error: error.message,
          workflow: scheduledJob.workflow,
          scheduleId: scheduledJob.id
        });
      }
    }
  }
  
  /**
   * Main processing loop
   */
  async processLoop() {
    if (!this.running) return;
    
    try {
      // Process available jobs
      await this.processJobs();
      
      // Update statistics
      this.updateStats();
      
      // Save state periodically
      if (this.options.enablePersistence && this.stats.totalJobs % 10 === 0) {
        await this.saveWorkflowState();
      }
    } catch (error) {
      logger.error('Error in workflow processing loop', { error: error.message });
    }
    
    // Continue processing
    setTimeout(() => {
      this.processLoop();
    }, 100); // Check every 100ms
  }
  
  /**
   * Process queued jobs
   */
  async processJobs() {
    while (this.jobQueue.length > 0 && this.getAvailableWorkers() > 0) {
      const job = this.jobQueue.shift();
      this.stats.queueLength = this.jobQueue.length;
      
      // Find available worker
      const worker = this.workers.find(w => !w.busy);
      if (worker) {
        // Assign job to worker
        worker.busy = true;
        worker.currentJob = job;
        this.stats.activeWorkers++;
        
        // Process job asynchronously
        this.processJob(worker, job);
      } else {
        // Put job back in queue if no workers available
        this.jobQueue.unshift(job);
        break;
      }
    }
  }
  
  /**
   * Process a single job
   */
  async processJob(worker, job) {
    try {
      job.status = 'running';
      job.startedAt = new Date().toISOString();
      this.jobs.set(job.id, job);
      
      logger.info(`Processing job: ${job.workflow}`, { jobId: job.id });
      
      // Emit event
      this.emit('job.started', job);
      
      // Get workflow function
      const workflow = this.workflows.get(job.workflow);
      if (!workflow) {
        throw new Error(`Workflow not found: ${job.workflow}`);
      }
      
      // Execute workflow with step support
      const result = await this.executeWorkflowWithSteps(workflow, job);
      
      // Job completed successfully
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.result = result;
      this.jobs.set(job.id, job);
      this.stats.completedJobs++;
      
      logger.info(`Job completed: ${job.workflow}`, { jobId: job.id });
      
      // Emit event
      this.emit('job.completed', job);
      
    } catch (error) {
      logger.error(`Job failed: ${job.workflow}`, { 
        error: error.message, 
        jobId: job.id 
      });
      
      // Handle retries
      if (job.attempt < this.options.maxRetries) {
        job.attempt++;
        job.status = 'retrying';
        job.error = error.message;
        this.jobs.set(job.id, job);
        
        logger.info(`Retrying job: ${job.workflow}`, { 
          jobId: job.id, 
          attempt: job.attempt 
        });
        
        // Add back to queue with delay
        setTimeout(() => {
          this.jobQueue.push(job);
          this.stats.queueLength = this.jobQueue.length;
        }, this.options.retryDelay * job.attempt);
        
        // Emit event
        this.emit('job.retrying', job);
      } else {
        // Job failed permanently
        job.status = 'failed';
        job.completedAt = new Date().toISOString();
        job.error = error.message;
        this.jobs.set(job.id, job);
        this.stats.failedJobs++;
        
        logger.error(`Job failed permanently: ${job.workflow}`, { 
          error: error.message, 
          jobId: job.id 
        });
        
        // Emit event
        this.emit('job.failed', job);
      }
    } finally {
      // Free worker
      worker.busy = false;
      worker.currentJob = null;
      this.stats.activeWorkers--;
    }
  }
  
  /**
   * Execute workflow with step support
   */
  async executeWorkflowWithSteps(workflow, job) {
    // Create step context
    const stepContext = {
      run: async (stepName, fn) => {
        logger.debug(`Executing step: ${stepName}`, { jobId: job.id });
        
        // Emit step event
        this.emit('step.started', { 
          jobId: job.id, 
          stepName,
          timestamp: new Date().toISOString()
        });
        
        try {
          const result = await fn();
          
          // Emit step completion event
          this.emit('step.completed', { 
            jobId: job.id, 
            stepName,
            timestamp: new Date().toISOString(),
            result
          });
          
          return result;
        } catch (error) {
          // Emit step error event
          this.emit('step.failed', { 
            jobId: job.id, 
            stepName,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          
          throw error;
        }
      },
      
      sendEvent: async (eventName, eventData) => {
        logger.debug(`Sending event: ${eventName}`, { jobId: job.id });
        
        // Emit event
        this.emit(eventName, {
          ...eventData,
          jobId: job.id,
          timestamp: new Date().toISOString()
        });
        
        return { sent: true };
      }
    };
    
    // Execute workflow function with step context
    const event = {
      data: job.data,
      step: stepContext
    };
    
    return await workflow.fn(event);
  }
  
  /**
   * Get number of available workers
   */
  getAvailableWorkers() {
    return this.workers.filter(w => !w.busy).length;
  }
  
  /**
   * Update engine statistics
   */
  updateStats() {
    this.stats.queueLength = this.jobQueue.length;
    this.stats.activeWorkers = this.workers.filter(w => w.busy).length;
  }
  
  /**
   * Get job by ID
   * @param {string} jobId - Job ID
   */
  getJob(jobId) {
    return this.jobs.get(jobId);
  }
  
  /**
   * Get all jobs
   */
  getAllJobs() {
    return Array.from(this.jobs.values());
  }
  
  /**
   * Get workflow statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      workflows: this.workflows.size,
      scheduledJobs: this.scheduledJobs.size,
      workers: this.workers.length
    };
  }
  
  /**
   * Cancel a job
   * @param {string} jobId - Job ID to cancel
   */
  async cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    
    if (job.status === 'running') {
      // Try to cancel running job
      const worker = this.workers.find(w => w.currentJob && w.currentJob.id === jobId);
      if (worker) {
        worker.busy = false;
        worker.currentJob = null;
        this.stats.activeWorkers--;
      }
    } else if (job.status === 'queued') {
      // Remove from queue
      const index = this.jobQueue.findIndex(j => j.id === jobId);
      if (index !== -1) {
        this.jobQueue.splice(index, 1);
        this.stats.queueLength = this.jobQueue.length;
      }
    }
    
    job.status = 'cancelled';
    job.completedAt = new Date().toISOString();
    this.jobs.set(jobId, job);
    
    logger.info(`Job cancelled: ${job.workflow}`, { jobId });
    
    // Emit event
    this.emit('job.cancelled', job);
    
    return true;
  }
  
  /**
   * Stop the workflow engine
   */
  async stop() {
    if (!this.running) return;
    
    logger.info('Stopping workflow engine...');
    
    // Stop accepting new jobs
    this.running = false;
    
    // Wait for running jobs to complete
    while (this.stats.activeWorkers > 0) {
      logger.info(`Waiting for ${this.stats.activeWorkers} jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save final state
    if (this.options.enablePersistence) {
      await this.saveWorkflowState();
    }
    
    logger.info('Workflow engine stopped');
    
    // Emit event
    this.emit('engine.stopped');
  }
}

module.exports = WorkflowEngine;