import {
  CheckCircle,
  Info,
  Spinner,
  WarningCircle,
  WarningOctagon,
} from "@phosphor-icons/react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/components/theme-provider";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CheckCircle className="size-5" weight="fill" />,
        info: <Info className="size-5" weight="fill" />,
        warning: <WarningCircle className="size-5" weight="fill" />,
        error: <WarningOctagon className="size-5" weight="fill" />,
        loading: <Spinner className="size-5 animate-spin" />,
      }}
      style={{
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "var(--radius)",
      }}
      {...props}
    />
  );
};

export { Toaster };
