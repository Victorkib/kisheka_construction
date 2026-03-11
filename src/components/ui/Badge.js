/**
 * Badge UI Component
 * Provides small status labels with variants and sizes.
 */

const VARIANT_CLASSES = {
  success: 'bg-emerald-500/10 text-emerald-200 border border-emerald-400/60',
  info: 'bg-blue-500/10 text-blue-200 border border-blue-400/60',
  warning: 'bg-amber-500/10 text-amber-200 border border-amber-400/60',
  danger: 'bg-red-500/10 text-red-200 border border-red-400/60',
  gray: 'bg-slate-500/10 text-slate-200 border border-slate-400/60',
  neutral: 'bg-slate-500/10 text-slate-200 border border-slate-400/60',
};

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
};

export default function Badge({
  children,
  variant = 'gray',
  size = 'sm',
  className = '',
  ...props
}) {
  const variantClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.gray;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
  const classes = `inline-flex items-center gap-1 rounded-full font-medium ${sizeClass} ${variantClass} ${className}`.trim();

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
