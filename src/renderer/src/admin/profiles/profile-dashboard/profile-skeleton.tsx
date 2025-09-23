import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

export const ProfileSkeleton: React.FC = () => {
  return (
    <Card className="bg-background/80 backdrop-blur-sm border-border/40 rounded-xl shadow-sm overflow-hidden relative h-[180px]">
      {/* Background effects */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[40%] -right-[20%] w-[60%] h-[60%] bg-gradient-to-br from-primary/5 via-primary/10 to-transparent rounded-full blur-3xl opacity-30 animate-pulse"></div>
      </div>
      
      <CardHeader className="p-5 pb-2">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32 bg-primary/10" />
            <Skeleton className="h-3 w-24 bg-muted" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full bg-primary/10" />
        </div>
      </CardHeader>
      
      <CardContent className="p-5 pt-2 pb-2">
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-10 w-10 rounded-full bg-primary/10" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-20 bg-muted" />
              <Skeleton className="h-3 w-16 bg-muted" />
            </div>
          </div>
          <Skeleton className="h-3 w-full bg-muted" />
        </div>
      </CardContent>
      
      <CardFooter className="p-5 pt-2 flex justify-between items-center">
        <Skeleton className="h-8 w-24 bg-primary/10 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-full bg-muted" />
      </CardFooter>
    </Card>
  );
};

export const ProfileDetailsSkeleton: React.FC = () => {
  return (
    <Card className="bg-background/80 backdrop-blur-sm border-border/40 rounded-xl shadow-sm overflow-hidden relative h-[400px] flex flex-col">
      {/* Background effects */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[40%] -right-[20%] w-[60%] h-[60%] bg-gradient-to-br from-primary/5 via-primary/10 to-transparent rounded-full blur-3xl opacity-30 animate-pulse"></div>
      </div>
      
      <CardHeader className="relative">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40 bg-primary/10" />
            <Skeleton className="h-4 w-32 bg-muted" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full bg-primary/10" />
        </div>
      </CardHeader>
      
      <div className="mx-6 mb-4">
        <Skeleton className="h-10 w-full bg-primary/10 rounded-md" />
      </div>
      
      <CardContent className="pt-6 flex-1 overflow-auto space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 bg-primary/5 rounded-lg" />
          ))}
        </div>
        
        <Skeleton className="h-24 w-full bg-primary/5 rounded-lg" />
        <Skeleton className="h-10 w-full bg-primary/10 rounded-md" />
      </CardContent>
      
      <CardFooter className="flex justify-between border-t border-border/40 bg-background/50 backdrop-blur-sm">
        <Skeleton className="h-10 w-32 bg-primary/10 rounded-md" />
        <div className="flex space-x-2">
          <Skeleton className="h-10 w-10 rounded-full bg-muted" />
          <Skeleton className="h-10 w-10 rounded-full bg-muted" />
        </div>
      </CardFooter>
    </Card>
  );
};

export const ProfileGridSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <ProfileSkeleton key={i} />
      ))}
    </div>
  );
};
