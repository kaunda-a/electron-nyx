import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { Calendar, Clock } from 'lucide-react';

interface CampaignSchedule {
  enabled: boolean;
  timezone: string;
  dailySchedule: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
  weeklySchedule: {
    enabled: boolean;
    activeDays: number[];
  };
  dateRange: {
    enabled: boolean;
    startDate: string | null;
    endDate: string | null;
  };
}

interface CampaignSchedulingProps {
  schedule: CampaignSchedule;
  onChange: (schedule: CampaignSchedule) => void;
}

export function CampaignScheduling({ schedule, onChange }: CampaignSchedulingProps) {
  const handleScheduleChange = (field: string, value: any) => {
    onChange({
      ...schedule,
      [field]: value
    });
  };

  const handleNestedChange = (parent: string, field: string, value: any) => {
    onChange({
      ...schedule,
      [parent]: {
        ...schedule[parent as keyof CampaignSchedule],
        [field]: value
      }
    });
  };

  const toggleDay = (day: number) => {
    const activeDays = [...schedule.weeklySchedule.activeDays];
    if (activeDays.includes(day)) {
      // Remove day
      const index = activeDays.indexOf(day);
      activeDays.splice(index, 1);
    } else {
      // Add day
      activeDays.push(day);
    }
    
    handleNestedChange('weeklySchedule', 'activeDays', activeDays);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Switch
          id="schedule-enabled"
          checked={schedule.enabled}
          onCheckedChange={(checked) => handleScheduleChange('enabled', checked)}
        />
        <Label htmlFor="schedule-enabled">Enable Scheduling</Label>
      </div>

      {schedule.enabled && (
        <>
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Select 
              value={schedule.timezone} 
              onValueChange={(value) => handleScheduleChange('timezone', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                <SelectItem value="Europe/Paris">Paris (CET/CEST)</SelectItem>
                <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                <SelectItem value="Asia/Shanghai">Shanghai (CST)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Accordion type="single" collapsible>
            <AccordionItem value="daily">
              <AccordionTrigger>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Daily Schedule
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="daily-enabled"
                      checked={schedule.dailySchedule.enabled}
                      onCheckedChange={(checked) => handleNestedChange('dailySchedule', 'enabled', checked)}
                    />
                    <Label htmlFor="daily-enabled">Enable Daily Schedule</Label>
                  </div>
                  {schedule.dailySchedule.enabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="startTime">Start Time</Label>
                        <Input
                          id="startTime"
                          type="time"
                          value={schedule.dailySchedule.startTime}
                          onChange={(e) => handleNestedChange('dailySchedule', 'startTime', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="endTime">End Time</Label>
                        <Input
                          id="endTime"
                          type="time"
                          value={schedule.dailySchedule.endTime}
                          onChange={(e) => handleNestedChange('dailySchedule', 'endTime', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="weekly">
              <AccordionTrigger>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Weekly Schedule
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="weekly-enabled"
                      checked={schedule.weeklySchedule.enabled}
                      onCheckedChange={(checked) => handleNestedChange('weeklySchedule', 'enabled', checked)}
                    />
                    <Label htmlFor="weekly-enabled">Enable Weekly Schedule</Label>
                  </div>
                  {schedule.weeklySchedule.enabled && (
                    <div>
                      <Label>Active Days</Label>
                      <div className="grid grid-cols-7 gap-2 mt-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                          <div key={day} className="flex flex-col items-center">
                            <Label className="text-xs mb-1">{day}</Label>
                            <Switch
                              checked={schedule.weeklySchedule.activeDays.includes(index)}
                              onCheckedChange={() => toggleDay(index)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="date-range">
              <AccordionTrigger>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Date Range
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="daterange-enabled"
                      checked={schedule.dateRange.enabled}
                      onCheckedChange={(checked) => handleNestedChange('dateRange', 'enabled', checked)}
                    />
                    <Label htmlFor="daterange-enabled">Enable Date Range</Label>
                  </div>
                  {schedule.dateRange.enabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="startDate">Start Date</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={schedule.dateRange.startDate || ''}
                          onChange={(e) => handleNestedChange('dateRange', 'startDate', e.target.value || null)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="endDate">End Date</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={schedule.dateRange.endDate || ''}
                          onChange={(e) => handleNestedChange('dateRange', 'endDate', e.target.value || null)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}
    </div>
  );
}