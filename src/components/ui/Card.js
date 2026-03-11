/**
 * Card UI Component
 * Simple container with default styling.
 */

export default function Card({ children, className = '', ...props }) {
  const classes = `ds-bg-surface rounded-lg shadow border ds-border-subtle ${className}`.trim();

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
