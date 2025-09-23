import { CampaignCreate, CampaignUpdate } from '../data/schema';
import { CampaignErrorHandler } from './error-handler';

export interface ValidationError {
  field: string;
  message: string;
}

export class CampaignValidator {
  static validateCreate(data: Partial<CampaignCreate>): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate required fields
    if (!data.name || data.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Campaign name is required' });
    }

    // Validate settings if provided
    if (data.settings) {
      if (data.settings.dailyVisitTarget !== undefined && data.settings.dailyVisitTarget <= 0) {
        errors.push({ field: 'dailyVisitTarget', message: 'Daily visit target must be greater than 0' });
      }

      if (data.settings.maxConcurrentSessions !== undefined && data.settings.maxConcurrentSessions <= 0) {
        errors.push({ field: 'maxConcurrentSessions', message: 'Max concurrent sessions must be greater than 0' });
      }

      if (data.settings.sessionDuration) {
        if (data.settings.sessionDuration.min >= data.settings.sessionDuration.max) {
          errors.push({ field: 'sessionDuration', message: 'Session duration minimum must be less than maximum' });
        }
      }

      if (data.settings.clickRate) {
        if (data.settings.clickRate.min < 0 || data.settings.clickRate.max > 100) {
          errors.push({ field: 'clickRate', message: 'Click rate must be between 0 and 100' });
        }
        if (data.settings.clickRate.min >= data.settings.clickRate.max) {
          errors.push({ field: 'clickRate', message: 'Click rate minimum must be less than maximum' });
        }
      }

      if (data.settings.bounceRate) {
        if (data.settings.bounceRate.min < 0 || data.settings.bounceRate.max > 100) {
          errors.push({ field: 'bounceRate', message: 'Bounce rate must be between 0 and 100' });
        }
        if (data.settings.bounceRate.min >= data.settings.bounceRate.max) {
          errors.push({ field: 'bounceRate', message: 'Bounce rate minimum must be less than maximum' });
        }
      }
    }

    // Validate targeting if provided
    if (data.targeting) {
      if (data.targeting.countries && data.targeting.countries.length === 0) {
        errors.push({ field: 'countries', message: 'At least one target country is required' });
      }

      if (data.targeting.adNetworks && data.targeting.adNetworks.length === 0) {
        errors.push({ field: 'adNetworks', message: 'At least one ad network is required' });
      }
    }

    // Validate targets
    if (data.targets) {
      if (!data.targets.urls || data.targets.urls.length === 0) {
        errors.push({ field: 'urls', message: 'At least one target URL is required' });
      } else {
        // Validate each URL
        for (let i = 0; i < data.targets.urls.length; i++) {
          const url = data.targets.urls[i];
          try {
            new URL(url);
          } catch (e) {
            errors.push({ field: `url-${i}`, message: `Invalid URL: ${url}` });
          }
        }
      }

      // Validate behavior
      if (data.targets.behavior && !['random', 'sequential', 'weighted'].includes(data.targets.behavior)) {
        errors.push({ field: 'behavior', message: 'Invalid target behavior' });
      }
    }

    // Validate schedule if provided
    if (data.schedule) {
      if (data.schedule.dateRange && data.schedule.dateRange.enabled) {
        if (!data.schedule.dateRange.startDate || !data.schedule.dateRange.endDate) {
          errors.push({ field: 'dateRange', message: 'Start and end dates are required when date range is enabled' });
        } else if (new Date(data.schedule.dateRange.startDate) >= new Date(data.schedule.dateRange.endDate)) {
          errors.push({ field: 'dateRange', message: 'Start date must be before end date' });
        }
      }

      if (data.schedule.dailySchedule && data.schedule.dailySchedule.enabled) {
        if (!data.schedule.dailySchedule.startTime || !data.schedule.dailySchedule.endTime) {
          errors.push({ field: 'dailySchedule', message: 'Start and end times are required when daily schedule is enabled' });
        }
      }
    }

    // Validate profiles if provided
    if (data.profiles) {
      if (data.profiles.categoryDistribution) {
        const { newVisitor, returningRegular, loyalUser } = data.profiles.categoryDistribution;
        const total = newVisitor + returningRegular + loyalUser;
        if (total !== 100) {
          errors.push({ field: 'categoryDistribution', message: 'Profile distribution must total 100%' });
        }
      }
    }

    return errors;
  }

  static validateUpdate(data: Partial<CampaignUpdate>): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Special case: Only updating status - minimal validation
  if (Object.keys(data).length === 1 && 'status' in data) {
    if (data.status && !['draft', 'active', 'paused', 'completed'].includes(data.status)) {
      errors.push({ field: 'status', message: 'Invalid campaign status' });
    }
    return errors;
  }
  
  // For other updates, validate only the fields that are provided
  if (data.name !== undefined && (!data.name || data.name.trim().length === 0)) {
    errors.push({ field: 'name', message: 'Campaign name is required' });
  }
  
  // Validate status if it's being updated
  if (data.status !== undefined) {
    const validStatuses = ['draft', 'active', 'paused', 'completed'];
    if (data.status && !validStatuses.includes(data.status)) {
      errors.push({ field: 'status', message: 'Invalid campaign status' });
    }
  }
  
  // Validate type if it's being updated
  if (data.type !== undefined) {
    const validTypes = ['traffic', 'revenue', 'testing'];
    if (data.type && !validTypes.includes(data.type)) {
      errors.push({ field: 'type', message: 'Invalid campaign type' });
    }
  }
  
  // Validate priority if it's being updated
  if (data.priority !== undefined) {
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (data.priority && !validPriorities.includes(data.priority)) {
      errors.push({ field: 'priority', message: 'Invalid campaign priority' });
    }
  }
  
  // Validate settings if they're being updated (only the fields provided)
  if (data.settings !== undefined) {
    if (data.settings) {
      if (data.settings.dailyVisitTarget !== undefined && data.settings.dailyVisitTarget <= 0) {
        errors.push({ field: 'dailyVisitTarget', message: 'Daily visit target must be greater than 0' });
      }

      if (data.settings.maxConcurrentSessions !== undefined && data.settings.maxConcurrentSessions <= 0) {
        errors.push({ field: 'maxConcurrentSessions', message: 'Max concurrent sessions must be greater than 0' });
      }

      if (data.settings.sessionDuration) {
        if (data.settings.sessionDuration.min >= data.settings.sessionDuration.max) {
          errors.push({ field: 'sessionDuration', message: 'Session duration minimum must be less than maximum' });
        }
      }

      if (data.settings.clickRate) {
        if (data.settings.clickRate.min < 0 || data.settings.clickRate.max > 100) {
          errors.push({ field: 'clickRate', message: 'Click rate must be between 0 and 100' });
        }
        if (data.settings.clickRate.min >= data.settings.clickRate.max) {
          errors.push({ field: 'clickRate', message: 'Click rate minimum must be less than maximum' });
        }
      }

      if (data.settings.bounceRate) {
        if (data.settings.bounceRate.min < 0 || data.settings.bounceRate.max > 100) {
          errors.push({ field: 'bounceRate', message: 'Bounce rate must be between 0 and 100' });
        }
        if (data.settings.bounceRate.min >= data.settings.bounceRate.max) {
          errors.push({ field: 'bounceRate', message: 'Bounce rate minimum must be less than maximum' });
        }
      }
    }
  }

  // Validate targeting if it's being updated
  if (data.targeting !== undefined) {
    if (data.targeting) {
      if (data.targeting.countries && !Array.isArray(data.targeting.countries)) {
        errors.push({ field: 'countries', message: 'Targeting countries must be an array' });
      }
      
      if (data.targeting.adNetworks && !Array.isArray(data.targeting.adNetworks)) {
        errors.push({ field: 'adNetworks', message: 'Targeting ad networks must be an array' });
      }
    }
  }

  // Validate targets if they're being updated
  if (data.targets !== undefined) {
    if (data.targets && data.targets.urls) {
      if (!Array.isArray(data.targets.urls)) {
        errors.push({ field: 'urls', message: 'Target URLs must be an array' });
      } else {
        for (const url of data.targets.urls) {
          try {
            new URL(url);
          } catch (e) {
            errors.push({ field: 'urls', message: `Invalid URL: ${url}` });
          }
        }
      }
    }
  }

  return errors;
}

  static validateLaunch(campaign: Campaign): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate that the campaign has a name
    if (!campaign.name || campaign.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Campaign name is required' });
    }

    // Validate that the campaign has target URLs
    if (!campaign.targets || !campaign.targets.urls || campaign.targets.urls.length === 0) {
      errors.push({ field: 'targets', message: 'At least one target URL is required' });
    }

    // Validate that all target URLs are valid
    if (campaign.targets && campaign.targets.urls) {
      for (let i = 0; i < campaign.targets.urls.length; i++) {
        const url = campaign.targets.urls[i];
        try {
          new URL(url);
        } catch (e) {
          errors.push({ field: `url-${i}`, message: `Invalid URL: ${url}` });
        }
      }
    }

    // Validate that the campaign has valid settings
    if (campaign.settings) {
      if (campaign.settings.dailyVisitTarget !== undefined && campaign.settings.dailyVisitTarget <= 0) {
        errors.push({ field: 'dailyVisitTarget', message: 'Daily visit target must be greater than 0' });
      }

      if (campaign.settings.maxConcurrentSessions !== undefined && campaign.settings.maxConcurrentSessions <= 0) {
        errors.push({ field: 'maxConcurrentSessions', message: 'Max concurrent sessions must be greater than 0' });
      }

      if (campaign.settings.sessionDuration) {
        if (campaign.settings.sessionDuration.min >= campaign.settings.sessionDuration.max) {
          errors.push({ field: 'sessionDuration', message: 'Session duration minimum must be less than maximum' });
        }
      }

      if (campaign.settings.clickRate) {
        if (campaign.settings.clickRate.min < 0 || campaign.settings.clickRate.max > 100) {
          errors.push({ field: 'clickRate', message: 'Click rate must be between 0 and 100' });
        }
        if (campaign.settings.clickRate.min >= campaign.settings.clickRate.max) {
          errors.push({ field: 'clickRate', message: 'Click rate minimum must be less than maximum' });
        }
      }

      if (campaign.settings.bounceRate) {
        if (campaign.settings.bounceRate.min < 0 || campaign.settings.bounceRate.max > 100) {
          errors.push({ field: 'bounceRate', message: 'Bounce rate must be between 0 and 100' });
        }
        if (campaign.settings.bounceRate.min >= campaign.settings.bounceRate.max) {
          errors.push({ field: 'bounceRate', message: 'Bounce rate minimum must be less than maximum' });
        }
      }
    }

    // Validate that the campaign has valid targeting
    if (campaign.targeting) {
      if (campaign.targeting.countries && campaign.targeting.countries.length === 0) {
        errors.push({ field: 'countries', message: 'At least one target country is required' });
      }

      if (campaign.targeting.adNetworks && campaign.targeting.adNetworks.length === 0) {
        errors.push({ field: 'adNetworks', message: 'At least one ad network is required' });
      }
    }

    // Validate that the campaign has a valid profile assignment
    if (campaign.profiles) {
      if (campaign.profiles.assignmentType === 'manual' && 
          (!campaign.profiles.assignedProfiles || campaign.profiles.assignedProfiles.length === 0)) {
        errors.push({ field: 'assignedProfiles', message: 'At least one profile must be assigned for manual assignment' });
      }

      if (campaign.profiles.assignmentType === 'category') {
        const { newVisitor, returningRegular, loyalUser } = campaign.profiles.categoryDistribution || { newVisitor: 0, returningRegular: 0, loyalUser: 0 };
        const total = newVisitor + returningRegular + loyalUser;
        if (total !== 100) {
          errors.push({ field: 'categoryDistribution', message: 'Profile distribution must total 100%' });
        }
      }
    }

    return errors;
  }

  static formatErrors(errors: ValidationError[]): string {
    return errors.map(error => error.message).join(', ');
  }

  static hasErrors(errors: ValidationError[]): boolean {
    return errors.length > 0;
  }
  
  static handleValidationErrors(errors: ValidationError[]): void {
    CampaignErrorHandler.handleValidationErrors(errors);
  }
}