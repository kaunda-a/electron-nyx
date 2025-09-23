import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Sliders } from 'lucide-react';
import { CampaignFilters } from '../../context/campaigns-context';

interface AdvancedFilterProps {
  filters: CampaignFilters;
  onFiltersChange: (filters: CampaignFilters) => void;
}

export function AdvancedFilter({ filters, onFiltersChange }: AdvancedFilterProps) {
  const [localFilters, setLocalFilters] = useState<CampaignFilters>(filters);
  const [isOpen, setIsOpen] = useState(false);

  const applyFilters = () => {
    onFiltersChange(localFilters);
    setIsOpen(false);
  };

  const resetFilters = () => {
    const resetFilters = {
      search: filters.search,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder
    };
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
    setIsOpen(false);
  };

  const hasAdvancedFilters = () => {
    return localFilters.status || localFilters.type || localFilters.priority || 
           localFilters.minRevenue !== undefined || localFilters.maxRevenue !== undefined ||
           localFilters.minVisits !== undefined || localFilters.maxVisits !== undefined ||
           localFilters.dateFrom || localFilters.dateTo;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Sliders className="h-4 w-4 mr-2" />
          Filters
          {hasAdvancedFilters() && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-blue-500"></span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Advanced Filters</h4>
            <p className="text-sm text-muted-foreground">
              Filter campaigns by various criteria
            </p>
          </div>
          
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={localFilters.status || ''}
                  onValueChange={(value) => setLocalFilters(prev => ({
                    ...prev,
                    status: value === 'all' ? undefined : value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  value={localFilters.type || ''}
                  onValueChange={(value) => setLocalFilters(prev => ({
                    ...prev,
                    type: value === 'all' ? undefined : value
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="traffic">Traffic</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="testing">Testing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={localFilters.priority || ''}
                onValueChange={(value) => setLocalFilters(prev => ({
                  ...prev,
                  priority: value === 'all' ? undefined : value
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="minRevenue">Min Revenue</Label>
                <Input
                  id="minRevenue"
                  type="number"
                  value={localFilters.minRevenue || ''}
                  onChange={(e) => setLocalFilters(prev => ({
                    ...prev,
                    minRevenue: e.target.value ? parseFloat(e.target.value) : undefined
                  }))}
                  placeholder="0"
                />
              </div>
              
              <div>
                <Label htmlFor="maxRevenue">Max Revenue</Label>
                <Input
                  id="maxRevenue"
                  type="number"
                  value={localFilters.maxRevenue || ''}
                  onChange={(e) => setLocalFilters(prev => ({
                    ...prev,
                    maxRevenue: e.target.value ? parseFloat(e.target.value) : undefined
                  }))}
                  placeholder="10000"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="minVisits">Min Visits</Label>
                <Input
                  id="minVisits"
                  type="number"
                  value={localFilters.minVisits || ''}
                  onChange={(e) => setLocalFilters(prev => ({
                    ...prev,
                    minVisits: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  placeholder="0"
                />
              </div>
              
              <div>
                <Label htmlFor="maxVisits">Max Visits</Label>
                <Input
                  id="maxVisits"
                  type="number"
                  value={localFilters.maxVisits || ''}
                  onChange={(e) => setLocalFilters(prev => ({
                    ...prev,
                    maxVisits: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  placeholder="10000"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="dateFrom">Date From</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={localFilters.dateFrom || ''}
                  onChange={(e) => setLocalFilters(prev => ({
                    ...prev,
                    dateFrom: e.target.value || undefined
                  }))}
                />
              </div>
              
              <div>
                <Label htmlFor="dateTo">Date To</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={localFilters.dateTo || ''}
                  onChange={(e) => setLocalFilters(prev => ({
                    ...prev,
                    dateTo: e.target.value || undefined
                  }))}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-between">
            <Button variant="outline" onClick={resetFilters}>
              Reset
            </Button>
            <div className="space-x-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={applyFilters}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}