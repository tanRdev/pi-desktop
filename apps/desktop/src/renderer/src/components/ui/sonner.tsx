import {
  CheckCircle,
  Info,
  Spinner,
  WarningCircle,
  WarningOctagon,
} from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CheckCircle className="size-5" weight="fill" />,
        info: <Info className="size-5" weight="fill" />,
        warning: <WarningCircle className="size-5" weight="fill" />,
        error: <WarningOctagon className="size-5" weight="fill" />,
        loading: <Spinner className="size-5 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
