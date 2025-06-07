
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TradingConfigData } from '../types/configTypes';

interface NotesSectionProps {
  config: TradingConfigData;
  onInputChange: (field: keyof TradingConfigData, value: any) => void;
}

const NotesSection: React.FC<NotesSectionProps> = ({
  config,
  onInputChange
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes & Additional Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="notes">Trading Strategy Notes</Label>
          <Textarea
            id="notes"
            placeholder="Add any notes about your trading strategy, risk management rules, or configuration details..."
            value={config.notes || ''}
            onChange={(e) => onInputChange('notes', e.target.value)}
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default NotesSection;
