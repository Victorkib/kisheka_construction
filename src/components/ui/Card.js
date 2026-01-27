/**
 * Card UI Component
 * Simple container with default styling.
 */

export default function Card({ children, className = '', ...props }) {
  const classes = `bg-white rounded-lg shadow ${className}`.trim();

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
