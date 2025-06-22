import React from 'react';
import { Badge } from '@/components/ui/badge';

const BillingToggle = ({ billingCycle, setBillingCycle }) => {
  return (
    <div className="flex items-center justify-center space-x-4 mt-8">
      <span className={billingCycle === 'monthly' ? 'text-white font-semibold' : 'text-blue-200'}>
        Mensual
      </span>
      <button
        onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
        aria-label={`Cambiar a facturación ${billingCycle === 'monthly' ? 'anual' : 'mensual'}`}
        className="relative w-16 h-8 bg-white/20 rounded-full p-1 transition-colors"
      >
        <div
          className={`w-6 h-6 bg-white rounded-full transition-transform ${
            billingCycle === 'yearly' ? 'translate-x-8' : 'translate-x-0'
          }`}
        />
      </button>
      <span className={billingCycle === 'yearly' ? 'text-white font-semibold' : 'text-blue-200'}>
        Anual
      </span>
      {billingCycle === 'yearly' && (
        <Badge className="bg-green-500 text-white">
          Ahorra 20%
        </Badge>
      )}
    </div>
  );
};

export default BillingToggle;