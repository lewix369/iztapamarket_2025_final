import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Store, TrendingUp, BarChart3, Users } from 'lucide-react';

const AdminStats = ({ businesses }) => {
  const stats = [
    {
      title: "Total Negocios",
      value: businesses.length,
      icon: Store,
      color: "blue"
    },
    {
      title: "Plan Premium",
      value: businesses.filter(b => b.plan_type === 'Premium').length,
      icon: TrendingUp,
      color: "orange"
    },
    {
      title: "Plan Pro",
      value: businesses.filter(b => b.plan_type === 'Pro').length,
      icon: BarChart3,
      color: "blue"
    },
    {
      title: "Plan Free",
      value: businesses.filter(b => b.plan_type === 'Free').length,
      icon: Users,
      color: "gray"
    }
  ];

  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{stat.title}</p>
                      <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-full ${
                      stat.color === 'orange' ? 'bg-orange-100' : 
                      stat.color === 'blue' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <stat.icon className={`h-6 w-6 ${
                        stat.color === 'orange' ? 'text-orange-600' : 
                        stat.color === 'blue' ? 'text-blue-600' : 'text-gray-600'
                      }`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AdminStats;