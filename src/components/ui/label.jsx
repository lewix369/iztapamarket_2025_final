<<<<<<< HEAD
import React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
);
=======
import React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)
>>>>>>> 4bc38970 (Primer commit del proyecto listo para Vercel)

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
<<<<<<< HEAD
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
=======
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
>>>>>>> 4bc38970 (Primer commit del proyecto listo para Vercel)
