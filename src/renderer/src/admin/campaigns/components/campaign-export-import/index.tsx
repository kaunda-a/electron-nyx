import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Download, 
  Upload, 
  FileJson, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw 
} from 'lucide-react';
import { useCampaigns } from '../../context/campaigns-context';

export function CampaignExportImport() {
  const { campaigns, exportCampaigns, importCampaigns, refetchCampaigns } = useCampaigns();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importData, setImportData] = useState('');
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      await exportCampaigns();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSelected = async () => {
    // This would typically be called with selected campaign IDs
    // For now, we'll just export all
    await handleExportAll();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const jsonData = JSON.parse(content);
        setImportData(JSON.stringify(jsonData, null, 2));
        setImportResult(null);
      } catch (error) {
        setImportResult({
          success: false,
          message: 'Invalid JSON file. Please upload a valid JSON file.'
        });
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importData.trim()) {
      setImportResult({
        success: false,
        message: 'Please provide campaign data to import.'
      });
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const data = JSON.parse(importData);
      const result = await importCampaigns(data);
      
      setImportResult({
        success: true,
        message: `Successfully imported ${result.imported || 0} campaigns.`
      });
      
      // Clear the import data
      setImportData('');
      
      // Refresh campaigns
      await refetchCampaigns();
    } catch (error: any) {
      setImportResult({
        success: false,
        message: error.message || 'Failed to import campaigns. Please check the data format.'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearImport = () => {
    setImportData('');
    setImportResult(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Download className="h-5 w-5 mr-2" />
              Export Campaigns
            </CardTitle>
            <CardDescription>
              Export your campaigns to a JSON file for backup or transfer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Export all campaigns or selected campaigns to a JSON file.
              </p>
              <p className="text-sm text-muted-foreground">
                Total campaigns: {campaigns?.length || 0}
              </p>
            </div>
            
            <div className="flex space-x-2">
              <Button 
                onClick={handleExportAll} 
                disabled={isExporting || !campaigns?.length}
                className="flex-1"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export All
                  </>
                )}
              </Button>
            </div>
            
            <Alert>
              <FileJson className="h-4 w-4" />
              <AlertTitle>Export Format</AlertTitle>
              <AlertDescription>
                Campaigns are exported in JSON format containing all campaign data including settings, targeting, and performance metrics.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Import Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              Import Campaigns
            </CardTitle>
            <CardDescription>
              Import campaigns from a JSON file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-file">Upload JSON File</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="import-data">Or Paste JSON Data</Label>
              <Textarea
                id="import-data"
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste campaign JSON data here..."
                rows={6}
              />
            </div>
            
            {importResult && (
              <Alert variant={importResult.success ? "default" : "destructive"}>
                {importResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {importResult.success ? "Success" : "Error"}
                </AlertTitle>
                <AlertDescription>
                  {importResult.message}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex space-x-2">
              <Button 
                onClick={handleImport} 
                disabled={isImporting || !importData.trim()}
                className="flex-1"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Campaigns
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleClearImport}
                disabled={!importData.trim()}
              >
                Clear
              </Button>
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Import Requirements</AlertTitle>
              <AlertDescription>
                Imported campaigns must be in the correct JSON format. Existing campaigns with the same ID will be updated.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}