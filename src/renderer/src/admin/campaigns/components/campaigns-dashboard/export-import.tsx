import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Download, 
  Upload, 
  FileJson, 
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useCampaigns } from '../../context/campaigns-context';

interface CampaignExportImportProps {
  selectedCampaignIds: string[];
}

export function CampaignExportImport({ selectedCampaignIds }: CampaignExportImportProps) {
  const { exportCampaigns, importCampaigns } = useCampaigns();
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      // If specific campaigns are selected, export only those
      // Otherwise, export all campaigns
      const campaignIds = selectedCampaignIds.length > 0 ? selectedCampaignIds : undefined;
      await exportCampaigns(campaignIds);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      const result = await importCampaigns(data);
      setImportResult({
        success: true,
        message: `Successfully imported ${result.imported || 0} campaign(s)`
      });
    } catch (error: any) {
      setImportResult({
        success: false,
        message: error.message || 'Failed to import campaigns'
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Export Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Download className="h-5 w-5 mr-2" />
            Export Campaigns
          </CardTitle>
          <CardDescription>
            Export your campaign data to a JSON file for backup or migration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {selectedCampaignIds.length > 0 
                  ? `Export ${selectedCampaignIds.length} selected campaign(s)` 
                  : 'Export all campaigns'}
              </p>
              <p className="text-xs text-muted-foreground">
                JSON format
              </p>
            </div>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Import Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="h-5 w-5 mr-2" />
            Import Campaigns
          </CardTitle>
          <CardDescription>
            Import campaign data from a JSON file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-file">Select JSON file</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="import-file"
                type="file"
                accept=".json"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <Button 
                variant="outline" 
                onClick={handleImportClick}
                disabled={isImporting}
              >
                <FileJson className="h-4 w-4 mr-2" />
                Choose File
              </Button>
              <span className="text-sm text-muted-foreground">
                {fileInputRef.current?.files?.[0]?.name || 'No file selected'}
              </span>
            </div>
          </div>
          
          {isImporting && (
            <div className="flex items-center text-sm text-muted-foreground">
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
              Importing campaigns...
            </div>
          )}
          
          {importResult && (
            <div className={`flex items-center text-sm ${
              importResult.success ? 'text-green-600' : 'text-red-600'
            }`}>
              {importResult.success ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <AlertCircle className="h-4 w-4 mr-2" />
              )}
              {importResult.message}
            </div>
          )}
          
          <div className="text-xs text-muted-foreground">
            <p>Imported campaigns will be added to your existing campaigns.</p>
            <p>Any campaigns with the same ID will be updated.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}