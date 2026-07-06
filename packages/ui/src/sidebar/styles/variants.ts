import { cva } from "class-variance-authority";

export const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-lg p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[background-color,color,box-shadow,opacity,transform] duration-150 ease-out motion-reduce:transition-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-inset active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pe-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! group-data-[reader-focus-sidebar=true]/sidebar-wrapper:gap-2.25 group-data-[reader-focus-sidebar=true]/sidebar-wrapper:px-2.5 [&>span:last-child]:truncate [&>svg:not([class*='size-']):not([width])]:size-4 group-data-[reader-focus-sidebar=true]/sidebar-wrapper:[&>svg:not([class*='size-']):not([width])]:size-4.5 [&>svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default:
          "h-8 text-sm group-data-[reader-focus-sidebar=true]/sidebar-wrapper:h-10 group-data-[reader-focus-sidebar=true]/sidebar-wrapper:text-base group-data-[reader-focus-sidebar=true]/sidebar-wrapper:leading-6",
        lg: "h-12 text-sm group-data-[reader-focus-sidebar=true]/sidebar-wrapper:h-13 group-data-[reader-focus-sidebar=true]/sidebar-wrapper:text-base group-data-[reader-focus-sidebar=true]/sidebar-wrapper:leading-6 group-data-[collapsible=icon]:p-0!",
        sm: "h-7 text-xs group-data-[reader-focus-sidebar=true]/sidebar-wrapper:h-7.5 group-data-[reader-focus-sidebar=true]/sidebar-wrapper:text-sm group-data-[reader-focus-sidebar=true]/sidebar-wrapper:leading-5",
      },
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:text-secondary-foreground active:bg-secondary/80 data-[active=true]:bg-secondary data-[active=true]:text-secondary-foreground data-[state=open]:hover:bg-secondary/90 data-[state=open]:hover:text-secondary-foreground",
      },
    },
  },
);
