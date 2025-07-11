import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { performReconciliationAnalysis, analyzeCurrentDatabaseState } from '@/utils/performReconciliationAnalysis';
import { AlertCircle, CheckCircle, Database, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const ReconciliationAnalysis = () => {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [isAnalyzingDB, setIsAnalyzingDB] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [dbAnalysis, setDbAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runReconciliation = async () => {
    if (!user?.id) return;
    
    setIsRunning(true);
    setError(null);
    
    try {
      const result = await performReconciliationAnalysis(user.id);
      
      if (result.success) {
        setReport(result.report);
      } else {
        setError(result.error || 'Analysis failed');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const analyzeDatabase = async () => {
    if (!user?.id) return;
    
    setIsAnalyzingDB(true);
    setError(null);
    
    try {
      const result = await analyzeCurrentDatabaseState(user.id);
      setDbAnalysis(result);
    } catch (err) {
      setError(`Database analysis error: ${err.message}`);
    } finally {
      setIsAnalyzingDB(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Trade Reconciliation Analysis
          </CardTitle>
          <CardDescription>
            Compare your local database with actual Bybit data to identify inconsistencies and issues.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button 
              onClick={analyzeDatabase}
              disabled={isAnalyzingDB}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              {isAnalyzingDB ? 'Analyzing...' : 'Analyze Database State'}
            </Button>
            
            <Button 
              onClick={runReconciliation}
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              {isRunning ? 'Fetching from Bybit...' : 'Compare with Bybit Data'}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Database Analysis Results */}
      {dbAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database State Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{dbAnalysis.summary.totalTrades}</div>
                <div className="text-sm text-gray-600">Total Trades</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{dbAnalysis.summary.buyTrades}</div>
                <div className="text-sm text-gray-600">Buy Trades</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{dbAnalysis.summary.sellTrades}</div>
                <div className="text-sm text-gray-600">Sell Trades</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{dbAnalysis.summary.closedTrades}</div>
                <div className="text-sm text-gray-600">Closed Trades</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-xl font-semibold text-amber-600">{dbAnalysis.summary.closedBuyTrades}</div>
                <div className="text-sm text-gray-600">Closed BUY Trades</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-blue-600">{dbAnalysis.summary.activeBuyTrades}</div>
                <div className="text-sm text-gray-600">Active BUY Trades</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-purple-600">{dbAnalysis.summary.buyTradesWithProfit}</div>
                <div className="text-sm text-gray-600">BUY Trades with P&L</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-xl font-semibold text-green-600">${dbAnalysis.summary.totalProfitOnBuys?.toFixed(2) || '0.00'}</div>
                <div className="text-sm text-gray-600">Profit on BUY Trades</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-green-600">${dbAnalysis.summary.totalProfitOnSells?.toFixed(2) || '0.00'}</div>
                <div className="text-sm text-gray-600">Profit on SELL Trades</div>
              </div>
            </div>

            {dbAnalysis.issues && dbAnalysis.issues.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-600 mb-2">Issues Identified:</h4>
                <div className="space-y-2">
                  {dbAnalysis.issues.map((issue, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{issue}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bybit Reconciliation Results */}
      {report && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Bybit Reconciliation Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{report.summary.bybitOrdersCount}</div>
                <div className="text-sm text-gray-600">Bybit Orders</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{report.summary.localTradesCount}</div>
                <div className="text-sm text-gray-600">Local Trades</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">{report.summary.matchedTrades}</div>
                <div className="text-sm text-gray-600">Matched</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{report.summary.missingFromLocal}</div>
                <div className="text-sm text-gray-600">Missing from Local</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-xl font-semibold text-orange-600">{report.summary.extraInLocal}</div>
                <div className="text-sm text-gray-600">Extra in Local</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-amber-600">{report.summary.statusMismatches}</div>
                <div className="text-sm text-gray-600">Status Mismatches</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-purple-600">{report.summary.priceMismatches}</div>
                <div className="text-sm text-gray-600">Price Mismatches</div>
              </div>
            </div>

            {report.recommendations && report.recommendations.length > 0 && (
              <div>
                <h4 className="font-semibold text-blue-600 mb-2">Recommendations:</h4>
                <div className="space-y-2">
                  {report.recommendations.map((rec, index) => (
                    <Alert key={index}>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{rec}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReconciliationAnalysis;