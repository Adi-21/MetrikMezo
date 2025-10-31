import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

interface ApprovalInfoProps {
  action: string;
  isVisible: boolean;
}

export function ApprovalInfo({ action, isVisible }: ApprovalInfoProps) {
  if (!isVisible) return null;

  return (
    <Alert className="mb-4 border-blue-200 bg-blue-50">
      <Info className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-800">
        <strong>One-time setup:</strong> To {action}, you&apos;ll need to approve this action once. 
        This is a security feature to protect your tokens. After approval, future {action.toLowerCase()} actions will be seamless.
      </AlertDescription>
    </Alert>
  );
} 