# ServSwap - Service Exchange Platform

ServSwap is a modern platform that allows users to exchange services with others in a barter system. No money needed - just trade skills and talents!

## Features

- **User Authentication**: Secure signup, login, and profile management
- **Service Listings**: Users can create and manage their service offerings
- **Service Discovery**: Browse and search for services by category
- **Service Swapping**: Propose and accept service swaps with other users
- **Portfolio Showcase**: Display your work to attract potential swappers
- **Responsive Design**: Works on desktops, tablets, and mobile devices

## Tech Stack

- **Frontend**: Next.js with TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Deployment**: Vercel (recommended)

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- PostgreSQL database

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/servswap.git
   cd servswap
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Set up your environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/servswap"
   NEXTAUTH_SECRET="your-secret-key"
   NEXTAUTH_URL="http://localhost:3000"
   ```

4. Initialize the database:
   ```bash
   npx prisma db push
   # or
   yarn prisma db push
   ```

5. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Project Structure

```
servswap/
├── app/                  # Next.js app directory
│   ├── api/              # API routes
│   ├── auth/             # Authentication pages
│   ├── dashboard/        # Dashboard pages for authenticated users
│   ├── marketplace/      # Service discovery pages
│   ├── profile/          # User profile pages
│   ├── components/       # Reusable components
│   ├── lib/              # Library code
│   ├── hooks/            # React hooks
│   └── utils/            # Utility functions
├── prisma/               # Prisma schema and migrations
├── public/               # Static assets
└── ...                   # Config files
```

## Deployment

The easiest way to deploy ServSwap is using [Vercel](https://vercel.com):

1. Push your code to a GitHub repository
2. Import the project into Vercel
3. Set the environment variables
4. Deploy

## Stripe Subscription Setup

This application uses Stripe for subscription payments. To set up the Stripe integration:

1. Create a `.env.local` file in the root directory with the following variables:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Stripe API Keys - Replace with your actual keys
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Product/Price IDs - Basic Plan
STRIPE_PRICE_BASIC_MONTHLY=price_...
STRIPE_PRICE_BASIC_ANNUAL=price_...

# Stripe Product/Price IDs - Pro Plan
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...

# Stripe Product/Price IDs - Business Plan
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_ANNUAL=price_...

# Site URL Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

2. Create your subscription products and prices in the Stripe Dashboard:
   - Basic Plan: $9.99/month or $95.90/year (with 20% discount)
   - Professional Plan: $19.99/month or $191.90/year (with 20% discount)
   - Business Plan: $39.99/month or $383.90/year (with 20% discount)

3. For each product, add the `planId` metadata with values `basic`, `pro`, or `business`

4. Set up the Stripe webhook with endpoint: `https://yoursite.com/api/webhooks/stripe`
   - Listen for these events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `payment_intent.succeeded`, `payment_intent.payment_failed`

5. For local testing, use the Stripe CLI to forward webhook events:
   ```
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to all contributors who have helped shape this project
- Inspired by the sharing economy and skill-exchange communities
