import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            "group toast bg-background-secondary border border-border shadow-modal rounded-xl backdrop-blur-xl",
          title: "font-display font-semibold text-foreground",
          description: "text-caption text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90",
          cancelButton: "bg-secondary text-secondary-foreground rounded-lg hover:bg-background-hover",
          closeButton: "bg-background-hover hover:bg-background-tertiary border-border",
          success: "border-success/30 bg-success/10",
          error: "border-error/30 bg-error/10",
          warning: "border-warning/30 bg-warning/10",
          info: "border-info/30 bg-info/10",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
