/**
 * Badge UI Component
 * Provides small status labels with variants and sizes.
 */

const VARIANT_CLASSES = {
  success: 'bg-green-100 text-green-800',
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-800',
  neutral: 'bg-gray-100 text-gray-800',
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
