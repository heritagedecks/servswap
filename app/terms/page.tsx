'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function TermsOfServicePage() {
  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 text-center mb-8">Terms of Service</h1>
          <div className="space-y-8 text-gray-600">
            <p className="text-sm text-gray-500 mb-8">Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">1. Introduction</h2>
              <p>Welcome to ServSwap. These Terms of Service govern your use of our platform and provide information about our service.</p>
              <p>By accessing or using our platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not access or use our service.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">2. Service Description</h2>
              <p>ServSwap is a platform that enables users to connect with other users to exchange services. We do not provide any services ourselves but facilitate connections between users who wish to swap services.</p>
              <p>To access our platform, you need to pay a subscription fee. Additional fees may apply for premium features such as verification badges.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">3. Account Registration</h2>
              <p>To use ServSwap, you must register for an account and provide accurate and complete information. You are responsible for maintaining the security of your account and password.</p>
              <p>You must be at least 18 years old to create an account and use our services. By creating an account, you represent and warrant that you are at least 18 years old.</p>
              <p>We reserve the right to terminate or suspend accounts at our discretion, particularly if we suspect violation of these terms.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">4. User Conduct and Prohibited Activities</h2>
              <p>You agree not to engage in any of the following activities:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Using our service for any illegal purposes</li>
                <li>Offering services that are illegal or violate others' rights</li>
                <li>Posting false, misleading, or deceptive content</li>
                <li>Impersonating any person or entity</li>
                <li>Harassing, bullying, or intimidating other users</li>
                <li>Attempting to gain unauthorized access to our systems</li>
                <li>Interfering with the proper functioning of the platform</li>
                <li>Using the platform to spread malware or other harmful code</li>
                <li>Scraping or collecting user information without permission</li>
                <li>Creating multiple accounts to circumvent restrictions</li>
              </ul>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">5. User Content</h2>
              <p>You retain ownership of any content you post on ServSwap. However, by posting content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, adapt, publish, and display such content in connection with our services.</p>
              <p>You are solely responsible for the content you post. We do not endorse any user content and assume no liability for it.</p>
              <p>We reserve the right to remove any content that violates these terms or that we find objectionable.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">6. Service Swaps and Transactions</h2>
              <p>ServSwap is not a party to any agreements between users for service exchanges. We do not guarantee the quality, safety, or legality of services offered by users.</p>
              <p>Any agreement you make with another user is between you and that user. ServSwap is not responsible for disputes between users.</p>
              <p>We strongly recommend that users clearly communicate expectations, timelines, and specifics of service swaps before committing to an exchange.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">7. Liability Limitations</h2>
              <p>To the maximum extent permitted by law, ServSwap and its affiliates, officers, employees, agents, partners, and licensors will not be liable for:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Any indirect, incidental, special, consequential, or punitive damages</li>
                <li>Any loss of profits, data, use, goodwill, or other intangible losses</li>
                <li>Any damages related to your access to or use of (or inability to access or use) the service</li>
                <li>Any conduct or content of any third party on the service</li>
                <li>Any unauthorized access, use, or alteration of your content or transmissions</li>
                <li>Any damages resulting from service swaps with other users</li>
              </ul>
              <p>Our liability is limited to the amount you paid us in the past 12 months, or $100, whichever is greater.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">8. Indemnification</h2>
              <p>You agree to indemnify, defend, and hold harmless ServSwap and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, costs, or expenses, including reasonable attorneys' fees, arising out of or in any way connected with:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your access to or use of our service</li>
                <li>Your violation of these Terms of Service</li>
                <li>Your violation of any third-party right, including privacy or intellectual property rights</li>
                <li>Any service you provide to or receive from another user</li>
                <li>Any claim that your content caused damage to a third party</li>
              </ul>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">9. Subscription and Payments</h2>
              <p>Access to ServSwap requires a paid subscription. We offer monthly and annual subscription options.</p>
              <p>Subscription fees are charged at the beginning of the applicable subscription period and will automatically renew unless canceled before the renewal date.</p>
              <p>We reserve the right to change our subscription fees upon notice. Any changes to subscription fees will take effect at the start of the next subscription period.</p>
              <p>Refunds are provided in accordance with applicable law or at our discretion.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">10. Intellectual Property</h2>
              <p>The ServSwap name, logo, and all related names, logos, product and service names, designs, and slogans are trademarks of ServSwap or its affiliates. You may not use these marks without our prior written permission.</p>
              <p>Our platform, including its original content, features, and functionality, is owned by ServSwap and protected by copyright, trademark, and other intellectual property laws.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">11. Termination</h2>
              <p>We may terminate or suspend your account and access to our service immediately, without prior notice or liability, for any reason, including if you breach these Terms of Service.</p>
              <p>If you wish to terminate your account, you may simply discontinue using our service and cancel your subscription.</p>
              <p>All provisions of these Terms which by their nature should survive termination shall survive termination, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">12. Changes to Terms</h2>
              <p>We reserve the right to modify or replace these Terms of Service at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect.</p>
              <p>By continuing to access or use our service after any revisions become effective, you agree to be bound by the revised terms.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">13. Governing Law</h2>
              <p>These Terms shall be governed and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.</p>
              <p>Any dispute arising from or relating to these Terms shall be subject to the exclusive jurisdiction of the courts in the United States.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">14. Contact Information</h2>
              <p>If you have any questions about these Terms, please contact us at:</p>
              <p>Email: support@servswap.com</p>
            </section>
            
            <div className="py-6 border-t border-gray-200">
              <p className="text-gray-600">By using ServSwap, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.</p>
            </div>
          </div>
          
          <div className="mt-10 text-center">
            <Link href="/" className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 