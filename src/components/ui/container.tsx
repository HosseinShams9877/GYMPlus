import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils/cn";

type ContainerProps = PropsWithChildren<{
  className?: string;
}>;

export function Container({ className, children }: ContainerProps) {
  return <div className={cn("container", className)}>{children}</div>;
}
