import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight } from 'lucide-react';

const PricingCard = ({ plan, billingCycle, onSelectPlan, index }) => {
  const getColorClasses = (color) => {
    const colors = {
      gray: { bg: 'bg-gray-500', text: 'text-gray-600', button: 'bg-gray-600 hover:bg-gray-700' },
      blue: { bg: 'bg-blue-500', text: 'text-blue-600', button: 'bg-blue-600 hover:bg-blue-700' },
      orange: { bg: 'bg-orange-500', text: 'text-orange-600', button: 'bg-orange-600 hover:bg-orange-700' }
    };
    return colors[color] || colors.gray;
  };

  const colorClasses = getColorClasses(plan.color);
  const IconComponent = plan.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="relative"
    >
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
          <Badge className="bg-gradient-to-r from-blue-600 to-orange-600 text-white px-4 py-2 shadow-lg">
            🔥 Más Popular
          </Badge>
        </div>
      )}
      
      <Card className={`relative h-full ${plan.popular ? 'ring-2 ring-blue-500 shadow-2xl scale-105' : 'shadow-lg'} transition-all duration-300 hover:shadow-xl`}>
        <CardHeader className="text-center space-y-4 pb-8">
          <div className={`mx-auto w-16 h-16 ${colorClasses.bg} rounded-full flex items-center justify-center`}>
            <IconComponent className="h-8 w-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
            <CardDescription className="text-gray-600 mt-2">{plan.description}</CardDescription>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-center space-x-1">
              <span className="text-4xl font-bold text-gray-900">
                Q{plan.price[billingCycle]}
              </span>
              {plan.price[billingCycle] > 0 && (
                <span className="text-gray-500">/{billingCycle === 'monthly' ? 'mes' : 'año'}</span>
              )}
            </div>
            {billingCycle === 'yearly' && plan.price.monthly > 0 && (
              <p className="text-sm text-green-600 font-medium">
                Ahorras Q{(plan.price.monthly * 12 - plan.price.yearly)} al año
              </p>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Incluye:</h4>
            <ul className="space-y-2">
              {plan.features.map((feature, featureIndex) => (
                <li key={featureIndex} className="flex items-start space-x-3">
                  <Check className={`h-5 w-5 ${colorClasses.text} flex-shrink-0 mt-0.5`} />
                  <span className="text-gray-600 text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {plan.limitations && plan.limitations.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="font-semibold text-gray-500">Limitaciones:</h4>
              <ul className="space-y-2">
                {plan.limitations.map((limitation, limitIndex) => (
                  <li key={limitIndex} className="flex items-start space-x-3">
                    <div className="h-5 w-5 flex-shrink-0 mt-0.5"><div className="h-2 w-2 bg-gray-400 rounded-full mx-auto mt-1.5"></div></div>
                    <span className="text-gray-500 text-sm">{limitation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <Button
            onClick={() => onSelectPlan(plan)}
            className={`w-full ${colorClasses.button} text-white font-semibold py-3 shadow-lg hover:shadow-xl transition-all`}
            size="lg"
          >
            {plan.name === 'Free' ? 'Comenzar Gratis' : 'Seleccionar Plan'}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PricingCard;