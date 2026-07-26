import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Store, TrendingUp, BarChart3, Users } from "lucide-react";

const AdminStats = ({ businesses = [], stats }) => {
  const activeBusinesses = businesses.filter((b) => !b.is_deleted);
  const totals = stats || {
    total: activeBusinesses.length,
    premium: activeBusinesses.filter(
      (b) => String(b.plan_type).toLowerCase() === "premium"
    ).length,
    pro: activeBusinesses.filter(
      (b) => String(b.plan_type).toLowerCase() === "pro"
    ).length,
    free: activeBusinesses.filter(
      (b) => String(b.plan_type).toLowerCase() === "free"
    ).length,
  };

  const statCards = [
    {
      title: "Total Negocios",
      value: totals.total,
      icon: Store,
      color: "blue",
    },
    {
      title: "Plan Premium",
      value: totals.premium,
      icon: TrendingUp,
      color: "orange",
    },
    {
      title: "Plan Pro",
      value: totals.pro,
      icon: BarChart3,
      color: "blue",
    },
    {
      title: "Plan Free",
      value: totals.free,
      icon: Users,
      color: "gray",
    },
  ];

  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => (
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
                      <p className="text-3xl font-bold text-gray-900">
                        {stat.value}
                      </p>
                    </div>
                    <div
                      className={`p-3 rounded-full ${
                        stat.color === "orange"
                          ? "bg-orange-100"
                          : stat.color === "blue"
                          ? "bg-blue-100"
                          : "bg-gray-100"
                      }`}
                    >
                      <stat.icon
                        className={`h-6 w-6 ${
                          stat.color === "orange"
                            ? "text-orange-600"
                            : stat.color === "blue"
                            ? "text-blue-600"
                            : "text-gray-600"
                        }`}
                      />
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
