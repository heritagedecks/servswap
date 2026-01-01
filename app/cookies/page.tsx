'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function CookiePolicyPage() {
  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 text-center mb-8">Cookie Policy</h1>
          <div className="space-y-8 text-gray-600">
            <p className="text-sm text-gray-500 mb-8">Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">1. Introduction</h2>
              <p>This Cookie Policy explains how ServSwap ("we", "us", or "our") uses cookies and similar technologies to recognize you when you visit our website and platform. It explains what these technologies are and why we use them, as well as your rights to control our use of them.</p>
              <p>By continuing to use our website, you are agreeing to our use of cookies as described in this Cookie Policy.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">2. What Are Cookies?</h2>
              <p>Cookies are small data files that are placed on your computer or mobile device when you visit a website. Cookies are widely used by website owners to make their websites work, or to work more efficiently, as well as to provide reporting information.</p>
              <p>Cookies set by the website owner (in this case, ServSwap) are called "first-party cookies". Cookies set by parties other than the website owner are called "third-party cookies". Third-party cookies enable third-party features or functionality to be provided on or through the website (e.g., advertising, interactive content, and analytics).</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">3. Why Do We Use Cookies?</h2>
              <p>We use first-party and third-party cookies for several reasons. Some cookies are required for technical reasons in order for our website to operate, and we refer to these as "essential" or "strictly necessary" cookies. Other cookies enable us to track and target the interests of our users to enhance the experience on our website and platform. Third parties serve cookies through our website for analytics, personalization, and marketing purposes.</p>
              
              <p className="font-medium mt-4">Specifically, we use cookies for the following purposes:</p>
              
              <h3 className="text-xl font-medium text-gray-800 mt-4">Essential Cookies</h3>
              <p>These cookies are strictly necessary to provide you with services available through our website and to use some of its features, such as access to secure areas. Because these cookies are strictly necessary to deliver the website, you cannot refuse them without impacting how our website functions.</p>
              
              <h3 className="text-xl font-medium text-gray-800 mt-4">Performance and Functionality Cookies</h3>
              <p>These cookies are used to enhance the performance and functionality of our website but are non-essential to their use. However, without these cookies, certain functionality may become unavailable.</p>
              
              <h3 className="text-xl font-medium text-gray-800 mt-4">Analytics and Customization Cookies</h3>
              <p>These cookies collect information that is used either in aggregate form to help us understand how our website is being used or how effective our marketing campaigns are, or to help us customize our website for you.</p>
              
              <h3 className="text-xl font-medium text-gray-800 mt-4">Advertising Cookies</h3>
              <p>These cookies are used to make advertising messages more relevant to you. They perform functions like preventing the same ad from continuously reappearing, ensuring that ads are properly displayed, and in some cases selecting advertisements that are based on your interests.</p>
              
              <h3 className="text-xl font-medium text-gray-800 mt-4">Social Media Cookies</h3>
              <p>These cookies are used to enable you to share pages and content that you find interesting on our website through third-party social networking and other websites. These cookies may also be used for advertising purposes.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">4. What Types of Cookies Do We Use?</h2>
              
              <h3 className="text-xl font-medium text-gray-800">Session and Persistent Cookies</h3>
              <p>We use both session and persistent cookies on our website:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Session Cookies:</strong> These cookies are temporary and are erased when you close your browser. They are used to store temporary information, such as items in your shopping cart.</li>
                <li><strong>Persistent Cookies:</strong> These cookies remain on your device for a specified period or until you delete them. They help us recognize you as an existing user so it's easier to return to our website or interact with our services without signing in again.</li>
              </ul>
              
              <h3 className="text-xl font-medium text-gray-800 mt-4">First-Party and Third-Party Cookies</h3>
              <p>We use both first-party and third-party cookies:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>First-Party Cookies:</strong> These are cookies that we set on your device directly.</li>
                <li><strong>Third-Party Cookies:</strong> These are cookies that are set by a domain other than our website. We may use these cookies to help us analyze how our website is being used or to provide certain features.</li>
              </ul>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">5. Specific Cookies We Use</h2>
              
              <p>Below is a list of the main cookies that we use and what we use them for:</p>
              
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 mt-4">
                  <thead>
                    <tr>
                      <th className="py-3 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cookie Name</th>
                      <th className="py-3 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</th>
                      <th className="py-3 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                      <th className="py-3 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-500">auth_session</td>
                      <td className="py-3 px-4 text-sm text-gray-500">Authentication and session management</td>
                      <td className="py-3 px-4 text-sm text-gray-500">ServSwap</td>
                      <td className="py-3 px-4 text-sm text-gray-500">Session</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-500">preferences</td>
                      <td className="py-3 px-4 text-sm text-gray-500">Store user preferences</td>
                      <td className="py-3 px-4 text-sm text-gray-500">ServSwap</td>
                      <td className="py-3 px-4 text-sm text-gray-500">1 year</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-500">_ga</td>
                      <td className="py-3 px-4 text-sm text-gray-500">Analytics (Google Analytics)</td>
                      <td className="py-3 px-4 text-sm text-gray-500">Google</td>
                      <td className="py-3 px-4 text-sm text-gray-500">2 years</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-500">_gid</td>
                      <td className="py-3 px-4 text-sm text-gray-500">Analytics (Google Analytics)</td>
                      <td className="py-3 px-4 text-sm text-gray-500">Google</td>
                      <td className="py-3 px-4 text-sm text-gray-500">24 hours</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-500">_fbp</td>
                      <td className="py-3 px-4 text-sm text-gray-500">Marketing (Facebook Pixel)</td>
                      <td className="py-3 px-4 text-sm text-gray-500">Facebook</td>
                      <td className="py-3 px-4 text-sm text-gray-500">3 months</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">6. Managing Cookies</h2>
              
              <h3 className="text-xl font-medium text-gray-800">Browser Controls</h3>
              <p>Most web browsers allow you to manage cookies through their settings preferences. You can usually find these settings in the "options" or "preferences" menu of your browser. The following links may be helpful, or you can use the "Help" option in your browser for more details:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" className="text-indigo-600 hover:text-indigo-500">Cookie settings in Firefox</a></li>
                <li><a href="https://support.google.com/chrome/answer/95647" className="text-indigo-600 hover:text-indigo-500">Cookie settings in Chrome</a></li>
                <li><a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac" className="text-indigo-600 hover:text-indigo-500">Cookie settings in Safari</a></li>
                <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" className="text-indigo-600 hover:text-indigo-500">Cookie settings in Edge</a></li>
              </ul>
              
              <h3 className="text-xl font-medium text-gray-800 mt-4">Opt-Out of Third-Party Cookies</h3>
              <p>You can opt-out of interest-based advertising through some of the third parties we use by visiting the following links:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><a href="https://tools.google.com/dlpage/gaoptout" className="text-indigo-600 hover:text-indigo-500">Google Analytics Opt Out</a></li>
                <li><a href="https://www.facebook.com/settings/?tab=ads" className="text-indigo-600 hover:text-indigo-500">Facebook Ads Settings</a></li>
                <li><a href="http://www.aboutads.info/choices/" className="text-indigo-600 hover:text-indigo-500">Digital Advertising Alliance</a></li>
                <li><a href="http://www.youronlinechoices.eu/" className="text-indigo-600 hover:text-indigo-500">European Interactive Digital Advertising Alliance</a></li>
              </ul>
              
              <p className="mt-4">Please note that opting out of targeting cookies will not stop you from seeing ads, but the ads will no longer be tailored to your browsing habits.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">7. Other Tracking Technologies</h2>
              
              <h3 className="text-xl font-medium text-gray-800">Web Beacons</h3>
              <p>We may use web beacons (also known as pixel tags or clear GIFs) on our website. Web beacons are tiny graphics with a unique identifier, similar in function to cookies, that are used to track the online movements of users. Unlike cookies, which are stored on a user's computer, web beacons are embedded invisibly on web pages or in emails.</p>
              
              <h3 className="text-xl font-medium text-gray-800 mt-4">Local Storage</h3>
              <p>We may use local storage, such as HTML5 localStorage and indexedDB, to store content information and preferences. Various browsers may offer their own management tools for removing HTML5 local storage.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">8. Do Not Track</h2>
              <p>Currently, various browsers offer a "Do Not Track" option, but there is no standard for how DNT should work. Our website currently does not attempt to respond to Do Not Track signals. To learn more about Do Not Track, you can visit <a href="https://allaboutdnt.com/" className="text-indigo-600 hover:text-indigo-500">https://allaboutdnt.com/</a>.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">9. Changes to This Cookie Policy</h2>
              <p>We may update this Cookie Policy from time to time in order to reflect changes to the cookies we use or for other operational, legal, or regulatory reasons. Please revisit this Cookie Policy regularly to stay informed about our use of cookies and related technologies.</p>
              <p>The date at the top of this Cookie Policy indicates when it was last updated.</p>
            </section>
            
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800">10. Contact Us</h2>
              <p>If you have any questions about our use of cookies or other technologies, please contact us at:</p>
              <p>Email: privacy@servswap.com</p>
            </section>
            
            <div className="py-6 border-t border-gray-200">
              <p className="text-gray-600">By using ServSwap, you acknowledge that you have read and understood this Cookie Policy.</p>
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