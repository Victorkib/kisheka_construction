Kisheka Project – Construction Accountability System
You can copy it directly into a .md file or tell me if you want it exported to PDF, DOCX, or GitHub-style formatting.
________________________________________
Kisheka Project – Construction Accountability System
Version 1.0
________________________________________
1. Project Overview
The Kisheka Project is a 10-storey residential/commercial building initiative requiring a comprehensive digital system to ensure financial accuracy, material traceability, labour accountability, and investor transparency.
This system replaces Excel-based tracking with a structured, scalable, and auditable digital solution.
The objective is to provide:
•	Transparent financial management
•	Floor-by-floor cost tracking
•	Full visibility for investors/shareholders
•	Proper documentation of materials, labour, and approvals
•	Reduction of wastage, theft, and overpricing
•	Real-time reporting and analytics
________________________________________
2. Stakeholders
Stakeholder	Responsibilities
Project Owner	Full oversight, approvals, financial decisions
Investors / Shareholders	Funding, loan tracking, progress review
Project Manager	Approvals, supervision, reporting
Site Manager / Clerk	Daily data entry, receipts, material logs
Suppliers	Deliver materials, provide invoices
Labourers	Provide daily labour logged into system
________________________________________
3. Financial Structure
3.1 Capital Structure
•	Investor contributions
•	Loans (private or institutional)
•	Initial capital injection
•	Progressive financing
3.2 Cashflow Management
The system records:
•	Incoming funds
•	Expense categories
•	Daily spending
•	Running balance
•	Payment method tracking (Cash, M-Pesa, Bank)
3.3 Financial Reports
•	Budget vs Actual
•	Category breakdown
•	Supplier spending
•	Daily/weekly/monthly cost summaries
•	Investor statements
________________________________________
4. Initial Expenses Tracking
These baseline costs must be documented before construction begins.
Item	Description
Land Cost	Purchase amount of the land
Transfer Fees	Legal and administrative transfer charges
County Fees	Approval fees, rates, and inspection fees
Licenses & Permits	Construction permits, NCA, environmental
Probation & Approvals	Architectural approvals, survey approvals
Sinking Boreholes	Drilling, pump installation, testing
Electricity Applications	Transformers, meters, KPLC connection fees
Required Data Fields
Each initial expense must include:
•	Item name
•	Cost
•	Supplier/Agency
•	Receipt number
•	Supporting document attachment (PDF/JPG)
•	Approval (Project Manager / Owner)
•	Date paid
•	Entered by
•	Notes (optional)
________________________________________
5. Basement Construction
The basement phase includes:
•	Excavation
•	Formwork
•	Rebars
•	Saw dust
•	Concrete works
•	Labour (tracked daily)
Accountability Data for Basement Materials
For each material:
•	Material name
•	Quantity purchased
•	Quantity delivered
•	Quantity used
•	Remaining balance
•	Supplier name
•	Unit price
•	Total price
•	Receipt / Invoice attachment
•	Delivery Note attachment
•	Approved by
•	Date delivered
•	Date used
•	Entered by
Labour Logs
•	Labourer name
•	Work description
•	Date
•	Hours worked
•	Daily rate
•	Supervisor approval
•	Payment status
________________________________________
6. Floor-by-Floor Construction Tracking (Floors 1–10)
Each floor must be treated as a separate cost center.
6.1 Trackable Items per Floor
•	Structural materials (cement, sand, ballast, steel)
•	Reinforcements
•	Shuttering materials
•	Concrete volumes
•	Labour
•	Doors
•	Window panels
•	Windows
•	Floor-specific finishing items
6.2 Accountability Fields
For each item:
•	Floor number (1–10)
•	Category (Structural, Finishing, Electrical, etc.)
•	Material name
•	Quantity purchased
•	Quantity used on that floor
•	Unit cost
•	Total cost
•	Supplier
•	Receipt image
•	Delivered by
•	Received by
•	Approved by
•	Wastage (auto-calculated)
•	Date of usage
•	Notes
6.3 Progress Documentation
•	Daily site photos
•	Milestone completion percentages
•	Notes from project manager
________________________________________
7. Finishing Stages
________________________________________
7.1 Electrical Works
Includes:
•	Conduits
•	Wiring
•	Switches
•	Sockets
•	CCTV
•	Solar panels
•	Lithium batteries
•	Solar cables
•	Electrical labour
Accountability Fields
•	Item name
•	Brand
•	Supplier
•	Quantity
•	Unit cost
•	Total cost
•	Receipt attachment
•	Technician name
•	Date of installation
•	Approved by
________________________________________
7.2 Plumbing Works
Includes:
•	Finishings
•	Water meters
•	Tanks
•	Pumps
•	Showers
•	Toilets
•	Kitchen taps
•	Piping
•	Plumbing labour
Accountability Fields
Same structure as above.
________________________________________
7.3 Joinery / Carpentry
Includes:
•	Wardrobes
•	Kitchen cabinets
•	Vanity sinks
•	Door frames
•	Doors
•	Locks
•	Joiner labour
Accountability Fields
•	Item name
•	Material type
•	Quantity
•	Unit cost
•	Supplier
•	Installation team
•	Date installed
•	Verification photos
•	Approved by
________________________________________
7.4 Paintwork
Includes:
•	Paint
•	Wall filler
•	Undercoat
•	Finishing coat
•	Labour (rough and tough, finishing)
Accountability Fields
•	Brand
•	Colour
•	Quantity
•	Unit cost
•	Labour hours
•	Team leader
•	Floors painted
•	Date completed
________________________________________
7.5 Tiling & Terrazzo
Includes:
•	Tiles
•	Terrazzo
•	Grout
•	Labour
Accountability Fields
•	Tile type
•	Square meters covered
•	Labour cost
•	Wastage
•	Supplier
•	Floor number
________________________________________
7.6 Lift Installation
Includes:
•	Lift unit cost
•	Installation fees
•	Maintenance setup
•	Testing
•	Miscellaneous charges
Accountability Fields
•	Supplier name
•	Contract number
•	Payment schedule
•	Inspection certificates
•	Warranty documents
________________________________________
8. System Features & Requirements
________________________________________
8.1 User Roles
Role	Permissions
Owner	Full access, approvals, report access
Investor	Read-only reports, financial statements
Project Manager	Approvals, daily reviews, updates
Site Manager / Clerk	Data entry: materials, labour, receipts
Supplier	Upload delivery notes (optional)
________________________________________
8.2 Core System Features
A. Expense Tracking
•	Category-based input
•	Upload receipt/invoice
•	Auto-calculation of totals
B. Material Management
•	Purchase → Delivery → Usage → Balance
•	Wastage reporting
•	Floor-by-floor consumption tracking
C. Labour Tracking
•	Daily attendance
•	Category-based costing
•	Pending vs paid amounts
D. Document Attachments
•	PDF, Image receipts
•	Delivery notes
•	Contracts
E. Approval Workflows
•	Every entry must be approved by Project Manager/Owner
F. Reporting & Analytics
•	Daily, Weekly, Monthly reports
•	Budget vs actual
•	Category totals
•	Floor cost comparisons
•	Supplier summaries
________________________________________
9. Data Models (Simplified Technical Overview)
9.1 Expense
- id
- category
- subcategory
- itemName
- amount
- supplier
- receiptUrl
- approvedBy
- enteredBy
- notes
- createdAt
9.2 Material
- id
- name
- category
- floor
- qtyPurchased
- qtyDelivered
- qtyUsed
- unit
- unitCost
- supplier
- receiptUrl
- approvedBy
- enteredBy
- createdAt
9.3 Labour
- id
- labourerName
- role
- date
- hours
- dailyRate
- approvedBy
- status
- createdAt
9.4 Investor / Loan
- id
- investorName
- amountContributed
- loanTerms
- repaymentStatus
________________________________________
10. Audit Logs
The system will maintain an immutable log of:
•	Edits
•	Deletions
•	Approvals
•	Additions
•	Login attempts
Each record stores:
•	Action
•	User
•	Timestamp
________________________________________
11. Conclusion
The Kisheka Project – Construction Accountability System provides an end-to-end digital framework for capturing, verifying, and reporting every construction activity from land acquisition to the final finishing works.
It ensures complete transparency, reduces financial leakage, and establishes a professional documentation process suitable for investors and long-term property management.

