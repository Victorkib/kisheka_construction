/**
 * Button UI Component
 * Supports variants, sizes, and disabled state.
 */

const VARIANT_CLASSES = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-500 focus:ring-blue-500',
  secondary:
    'ds-bg-surface-muted ds-text-primary hover:ds-bg-surface focus:ring-slate-400',
  outline:
    'border ds-border-subtle ds-text-secondary hover:ds-bg-surface-muted focus:ring-slate-400',
  ghost:
    'bg-transparent ds-text-secondary hover:ds-bg-surface-muted focus:ring-slate-400',
  danger:
    'bg-red-600 text-white hover:bg-red-500 focus:ring-red-500',
};

const SIZE_CLASSES = {
  sm: 'text-sm px-3 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-base px-5 py-2.5',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  disabled = false,
  ...props
}) {
  const variantClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';
  const classes = [
    'inline-flex items-center justify-center rounded-lg font-medium',
    'transition focus:outline-none focus:ring-2 focus:ring-offset-2',
    variantClass,
    sizeClass,
    disabledClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} disabled={disabled} {...props}>
      {children}
    </button>
  );
}
