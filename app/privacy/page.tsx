'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 text-center mb-8">Privacy Policy</h1>
          <div className="space-y-8 text-gray-600">
            <p className="text-sm text-gray-500 mb-8">Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">1. Introduction</h2>
              <p>At ServSwap, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.</p>
              <p>Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the platform.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">2. Information We Collect</h2>
              
              <h3 className="text-xl font-medium text-gray-800">Personal Data</h3>
              <p>When you register and use ServSwap, we may collect the following personal information:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Contact information (name, email address, phone number)</li>
                <li>Account credentials (username, password)</li>
                <li>Profile information (biography, profile picture, location)</li>
                <li>Service descriptions and images you provide</li>
                <li>Messages exchanged with other users</li>
                <li>Subscription and payment information</li>
                <li>Endorsements and reviews you give or receive</li>
              </ul>
              
              <h3 className="text-xl font-medium text-gray-800">Usage Data</h3>
              <p>We automatically collect certain information when you visit, use, or navigate our platform, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Device and connection information (IP address, browser type, operating system)</li>
                <li>Usage patterns (pages visited, time spent on pages, navigation paths)</li>
                <li>Device identifiers (device ID, advertising ID)</li>
                <li>Time zone and location information</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">3. How We Use Your Information</h2>
              <p>We use the information we collect for various purposes, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Providing and maintaining our platform</li>
                <li>Verifying your identity and managing your account</li>
                <li>Facilitating service swaps between users</li>
                <li>Processing subscriptions and payments</li>
                <li>Communicating with you about updates, support, and promotions</li>
                <li>Personalizing your experience and content</li>
                <li>Analyzing usage patterns to improve our platform</li>
                <li>Detecting, preventing, and addressing technical issues, fraud, or illegal activity</li>
                <li>Complying with legal obligations</li>
                <li>Enforcing our terms, conditions, and policies</li>
              </ul>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">4. How We Share Your Information</h2>
              <p>We may share your information in the following situations:</p>
              
              <h3 className="text-xl font-medium text-gray-800">With Other Users</h3>
              <p>When you use our platform, certain information is visible to other users, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your profile information (name, profile picture, biography)</li>
                <li>Services you offer for exchange</li>
                <li>Reviews and endorsements given or received</li>
                <li>Messages you send to other users</li>
              </ul>
              
              <h3 className="text-xl font-medium text-gray-800">With Service Providers</h3>
              <p>We may share your information with third-party vendors, service providers, contractors, or agents who perform services for us and need access to such information to do that work. Examples include:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Payment processors</li>
                <li>Cloud hosting providers</li>
                <li>Analytics services</li>
                <li>Customer support services</li>
                <li>Email delivery services</li>
              </ul>
              
              <h3 className="text-xl font-medium text-gray-800">For Business Transfers</h3>
              <p>If ServSwap is involved in a merger, acquisition, or sale of all or a portion of our assets, your information may be transferred as part of that transaction.</p>
              
              <h3 className="text-xl font-medium text-gray-800">For Legal Compliance</h3>
              <p>We may disclose your information where required to do so by law or in response to valid requests by public authorities (e.g., a court or a government agency).</p>
              
              <h3 className="text-xl font-medium text-gray-800">To Protect Rights</h3>
              <p>We may disclose your information when we believe it is necessary to investigate, prevent, or take action regarding potential violations of our policies, suspected fraud, or situations involving potential threats to the safety of any person.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">5. Data Retention</h2>
              <p>We will retain your personal information only for as long as is necessary for the purposes set out in this privacy policy. We will retain and use your information to the extent necessary to comply with our legal obligations, resolve disputes, and enforce our policies.</p>
              <p>If you request deletion of your account, we will delete your personal information as soon as practicable, except for information we must keep for legitimate business or legal purposes.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">6. Data Security</h2>
              <p>We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards, no security system is impenetrable, and we cannot guarantee the security of our systems 100%.</p>
              <p>You are responsible for maintaining the secrecy of your unique password and account information and for controlling access to your account.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">7. Your Privacy Rights</h2>
              
              <h3 className="text-xl font-medium text-gray-800">Account Information</h3>
              <p>You can review and change your personal information by logging into your account and visiting your account settings page.</p>
              
              <h3 className="text-xl font-medium text-gray-800">Data Access, Correction, and Deletion</h3>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access the personal information we have about you</li>
                <li>Correct inaccurate or incomplete information</li>
                <li>Request deletion of your personal data (subject to certain exceptions)</li>
                <li>Object to our processing of your personal data</li>
                <li>Request restriction of processing of your personal data</li>
                <li>Request transfer of your personal data</li>
              </ul>
              
              <p>To exercise these rights, please contact us at privacy@servswap.com.</p>
              
              <h3 className="text-xl font-medium text-gray-800">California Residents</h3>
              <p>If you are a resident of California, you have specific rights regarding your personal information under the California Consumer Privacy Act (CCPA). For more information, please see our California Privacy Notice.</p>
              
              <h3 className="text-xl font-medium text-gray-800">European Residents</h3>
              <p>If you are a resident of the European Economic Area (EEA), you have certain data protection rights under the General Data Protection Regulation (GDPR). We aim to take reasonable steps to allow you to correct, amend, delete, or limit the use of your personal information.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">8. Cookies and Tracking</h2>
              <p>We use cookies and similar tracking technologies to collect and use personal information about you. For more information about the cookies and tracking technologies we use, please see our <Link href="/cookies" className="text-indigo-600 hover:text-indigo-500">Cookie Policy</Link>.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">9. Children's Privacy</h2>
              <p>Our platform is not intended for children under 18 years of age. We do not knowingly collect personal information from children under 18. If we learn we have collected or received personal information from a child under 18 without verification of parental consent, we will delete that information.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">10. Third-Party Websites</h2>
              <p>Our platform may contain links to third-party websites and applications. We are not responsible for the privacy practices or the content of these third-party sites. We encourage you to review the privacy policy of every site you visit.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">11. Changes to This Privacy Policy</h2>
              <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.</p>
              <p>You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">12. Contact Us</h2>
              <p>If you have any questions about this Privacy Policy, please contact us:</p>
              <p>Email: privacy@servswap.com</p>
            </section>
            
            <div className="py-6 border-t border-gray-200">
              <p className="text-gray-600">By using ServSwap, you acknowledge that you have read and understood this Privacy Policy.</p>
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