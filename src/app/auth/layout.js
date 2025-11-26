/**
 * Authentication Layout
 * Wrapper layout for all authentication pages (login, register, forgot password)
 */

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        {children}
      </div>
    </div>
  );
}

