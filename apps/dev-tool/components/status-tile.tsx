'use client';

import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

import { Card, CardContent } from '@kit/ui/card';

export const ServiceStatus = {
  CHECKING: 'checking',
  SUCCESS: 'success',
  WARNING: 'warning',
  INFO: 'info',
  ERROR: 'error',
} as const;

type ServiceStatusType = (typeof ServiceStatus)[keyof typeof ServiceStatus];

const StatusIcons = {
  [ServiceStatus.CHECKING]: <AlertCircle className="h-6 w-6 text-yellow-500" />,
  [ServiceStatus.SUCCESS]: <CheckCircle2 className="h-6 w-6 text-green-500" />,
  [ServiceStatus.WARNING]: <AlertCircle className="h-6 w-6 text-amber-500" />,
  [ServiceStatus.INFO]: <AlertCircle className="h-6 w-6 text-blue-500" />,
  [ServiceStatus.ERROR]: <XCircle className="h-6 w-6 text-red-500" />,
};

interface ServiceCardProps {
  name: string;
  status: {
    status: ServiceStatusType;
    message?: string;
  };
}

export const ServiceCard = ({ name, status }: ServiceCardProps) => {
  return (
    <Card className="w-full max-w-2xl">
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {StatusIcons[status.status]}

              <div>
                <h3 className="font-medium">{name}</h3>

                <p className="text-sm text-gray-500">
                  {status.message ??
                    (status.status === ServiceStatus.CHECKING
                      ? 'Checking connection...'
                      : status.status === ServiceStatus.SUCCESS
                        ? 'Connected successfully'
                        : 'Connection failed')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
