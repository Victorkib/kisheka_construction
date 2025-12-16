# Kisheka Construction System

A comprehensive construction accountability system for managing projects, materials, procurement, finances, and supplier communications.

**Version:** 2.0  
**Last Updated:** December 2024

---

## 🚀 Features

### Core Functionality
- **Project Management**: Create and manage construction projects with budget tracking
- **Material Procurement**: Complete workflow from request to purchase order to delivery
- **Supplier Management**: External supplier communication via email, SMS, and push notifications
- **Financial Tracking**: Real-time capital and budget monitoring with warnings
- **Category & Floor Management**: Organized material categorization with usage tracking
- **Bulk Operations**: Efficient bulk approval/rejection of material requests

### Key Improvements (v2.0)
- ✅ **Financial Validation**: Capital warnings throughout the workflow
- ✅ **Usage Tracking**: Prevent deletion of categories/floors in use
- ✅ **Configurable Options**: Environment-based validation controls
- ✅ **Enhanced Communication**: Multi-channel supplier notifications
- ✅ **URL Shortening**: Short links for SMS communication
- ✅ **Bulk Actions**: Efficient batch processing of requests
- ✅ **Capital Status Indicators**: Visual indicators for project capital health

---

## 📋 Prerequisites

- Node.js 18+ and npm
- MongoDB Atlas account (or local MongoDB)
- Supabase account for authentication
- Cloudinary account for file uploads
- Africa's Talking account (for SMS functionality, optional)

---

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kisheka_construction
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # MongoDB
   MONGODB_URI=your_mongodb_connection_string

   # Cloudinary
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   # Africa's Talking (SMS)
   SMS_ENABLED=true
   AFRICASTALKING_API_KEY=your_api_key
   AFRICASTALKING_USERNAME=your_username
   AFRICASTALKING_SENDER_ID=KISHEKA

   # App URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Optional: Financial Validation
   REQUIRE_PROJECT_BUDGET=false
   BLOCK_MATERIAL_CREATION_NO_CAPITAL=false

   # Optional: Auto-creation
   AUTO_CREATE_MATERIAL_ON_CONFIRM=false
   ```

4. **Set up database**
   ```bash
   npm run setup-db
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

6. **Open browser**
   Navigate to `http://localhost:3000`

---

## 📚 Documentation

- **[API Documentation](./docs/API.md)**: Complete API reference
- **[User Guide](./docs/USER_GUIDE.md)**: End-user documentation
- **[Workflow Analysis](./docs/sunrise/WORKFLOW_ANALYSIS_AND_ISSUES.md)**: Detailed system analysis
- **[Supplier Restructuring Plan](./docs/sunrise/SUPPLIER_RESTRUCTURING_PLAN.md)**: Supplier workflow details

---

## 🏗️ Project Structure

```
kisheka_construction/
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   ├── projects/          # Project pages
│   │   ├── items/             # Material pages
│   │   ├── material-requests/ # Request pages
│   │   ├── purchase-orders/   # PO pages
│   │   ├── suppliers/         # Supplier pages
│   │   └── ...
│   ├── components/            # React components
│   ├── lib/                   # Utilities and helpers
│   └── hooks/                 # Custom React hooks
├── docs/                      # Documentation
├── scripts/                   # Setup scripts
└── public/                    # Static assets
```

---

## 🔧 Configuration

### Financial Validation Options

Control validation behavior via environment variables:

**`REQUIRE_PROJECT_BUDGET`** (default: `false`)
- `true`: Blocks project creation if budget is 0
- `false`: Allows project creation with warning

**`BLOCK_MATERIAL_CREATION_NO_CAPITAL`** (default: `false`)
- `true`: Blocks material creation if no capital available
- `false`: Shows warning but allows creation

### SMS Configuration

**`SMS_ENABLED`** (default: `false`)
- Set to `true` to enable SMS functionality
- Requires Africa's Talking credentials

### Auto-Creation

**`AUTO_CREATE_MATERIAL_ON_CONFIRM`** (default: `false`)
- `true`: Automatically creates material entry when PO is confirmed
- `false`: Requires manual material entry creation

---

## 🔐 Authentication & Permissions

The system uses Supabase Auth for authentication with role-based access control:

- **OWNER**: Full system access
- **PROJECT_MANAGER**: Project and material management
- **CLERK**: Material entry and requests
- **SUPERVISOR**: Approval workflows
- **ACCOUNTANT**: Financial oversight
- **INVESTOR**: View-only access to own investments

---

## 📊 Key Workflows

### Material Procurement Flow

1. **Create Material Request** → Clerk creates request with estimated cost
2. **Approve Request** → Supervisor/PM approves request
3. **Create Purchase Order** → PM creates PO and selects supplier
4. **Supplier Responds** → Supplier accepts/rejects via email/SMS/push
5. **Material Entry** → Material entry created (manual or automatic)

### Financial Flow

1. **Allocate Capital** → Owner/Investor allocates capital to project
2. **Create Materials/Requests** → System checks capital availability
3. **Warnings Displayed** → User sees warnings if capital insufficient
4. **Monitor Status** → Capital status indicators show project health

---

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run linting
npm run lint

# Type checking (if using TypeScript)
npm run type-check
```

---

## 🚢 Deployment

### Vercel Deployment

1. Push code to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

### Environment Variables for Production

Ensure all environment variables are set in Vercel dashboard:
- Supabase credentials
- MongoDB connection string
- Cloudinary credentials
- Africa's Talking credentials (if SMS enabled)
- `NEXT_PUBLIC_APP_URL` set to production URL

---

## 🐛 Troubleshooting

### Common Issues

**"Cannot connect to MongoDB"**
- Verify `MONGODB_URI` is correct
- Check MongoDB Atlas network access settings

**"Authentication failed"**
- Verify Supabase credentials
- Check user permissions in Supabase dashboard

**"SMS not sending"**
- Verify `SMS_ENABLED=true`
- Check Africa's Talking credentials
- Verify phone number format (+country code)

**"Capital warnings appearing"**
- Allocate capital to projects from Investors section
- Review project finances page for details

---

## 📝 Changelog

### Version 2.0 (December 2024)

**New Features:**
- Financial validation and warnings throughout workflow
- Usage tracking for categories and floors
- Bulk operations for material requests
- Configurable validation options
- Enhanced supplier communication
- URL shortening for SMS links
- Capital status indicators

**Improvements:**
- Better error messages
- Improved validation logic
- Enhanced user experience
- Comprehensive documentation

**Bug Fixes:**
- Fixed estimated cost calculation
- Fixed project finances initialization
- Fixed material request status validation
- Fixed capital removal validation

---

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

---

## 📄 License

[Your License Here]

---

## 📞 Support

For issues, questions, or contributions:
- Check documentation in `/docs` folder
- Review API documentation
- Contact system administrator

---

**Built with ❤️ for Kisheka Construction**

