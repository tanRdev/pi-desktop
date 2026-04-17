import "react";

declare module "react" {
  interface CSSProperties {
    [cssCustomProperty: `--${string}`]: string | number | undefined;
  }
}
