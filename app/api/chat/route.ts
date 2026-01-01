import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// In a production environment, this would use embeddings and vector search
// For demo purposes, we'll use the same knowledge base from the front-end component
const knowledgeBase = {
  // General info
  'about': "ServSwap is a platform where users can exchange services without money. It operates on a barter system where you can swap your skills and talents with others.",
  'how it works': "ServSwap works in three simple steps: 1) Create a profile and list your services, 2) Browse the marketplace to find services you need, 3) Propose and complete service swaps with other users.",
  
  // Pricing and subscription
  'pricing': "ServSwap offers subscription plans starting at $10/month, or save with our annual plan at $99/year. A subscription is required to send swap proposals and message other users.",
  'subscription': "Your ServSwap subscription gives you full access to the platform, including unlimited swap proposals, messaging, and profile customization.",
  'cancel': "You can cancel your subscription anytime by going to your Account Settings > Subscription and clicking 'Cancel Subscription'. Your access will continue until the end of your billing period.",
  
  // Account and profile
  'create account': "To create an account on ServSwap, click the 'Sign Up' button in the top-right corner of the homepage. You'll need to provide your email address, create a password, and fill in your profile information. Once registered, you can subscribe to a plan and start listing your services.",
  'sign up': "To sign up for ServSwap, visit our homepage and click the 'Sign Up' button. Enter your email address, create a strong password, and follow the prompts to complete your profile. You'll need to choose a subscription plan to access all features.",
  'make account': "To make a ServSwap account, go to servswap.com and click 'Sign Up'. You'll need to enter your email, create a password, and set up your profile with information about your skills and services. Then choose a subscription plan to start swapping services.",
  'register': "To register on ServSwap, click the 'Sign Up' button on our homepage. You'll need to provide your email address, create a password, and complete your profile information. After registering, you can browse services but will need a subscription to propose swaps.",
  'profile': "Your ServSwap profile showcases your skills, services, and endorsements from other users. Keep it up-to-date to attract more swap opportunities.",
  'verification': "Verification on ServSwap adds a blue checkmark badge to your profile that confirms your identity and builds trust with other users. For verification ($5/month added to your subscription), you'll need to provide a government-issued ID and enable two-factor authentication. Your profile must be complete with a profile photo, bio, and at least one listed service.",
  'get verified': "To get verified on ServSwap, go to Account Settings > Verification. For verification ($5/month), you'll need to provide government-issued ID and enable two-factor authentication. Your profile must be complete with a profile photo, bio, and at least one listed service before applying for verification.",
  'verification badge': "The ServSwap verification badge is a blue checkmark that appears next to your name. It shows other users that your identity has been confirmed, which helps build trust. Verified accounts typically receive more swap proposals and have a higher acceptance rate due to the increased trust.",
  'password': "You can reset your password by clicking 'Forgot Password' on the login page or by going to Account Settings > Security.",
  
  // Services and swaps
  'service': "A service is any skill, talent, or expertise you offer to other users. Examples include graphic design, language lessons, cooking classes, or home repairs.",
  'swap': "A swap is an exchange of services between two users. There's no monetary exchange - just mutual value creation!",
  'proposal': "To propose a swap, navigate to another user's service, click 'Initiate Swap', and select one of your services to offer in exchange.",
  
  // Support and policies
  'contact': "You can reach our support team at support@servswap.com or through our contact form at servswap.com/contact.",
  'terms': "Our Terms of Service outline the rules and guidelines for using ServSwap. You can read them at servswap.com/terms.",
  'privacy': "Our Privacy Policy details how we collect, use, and protect your personal information. View it at servswap.com/privacy.",
  'cookies': "Our Cookie Policy explains how we use cookies and similar technologies. Find it at servswap.com/cookies.",
  
  // FAQ
  'faq': "Find answers to frequently asked questions at servswap.com/faq. Topics include account setup, service swaps, subscriptions, and more.",
};

// Knowledge base entries with metadata for better matching
interface KnowledgeEntry {
  content: string;
  topics: string[];
  keywords: string[];
  intents: string[];
}

// Convert the simple knowledgeBase to a more structured format with metadata
const enhancedKnowledgeBase: Record<string, KnowledgeEntry> = {
  about: {
    content: knowledgeBase['about'],
    topics: ['general', 'platform', 'concept'],
    keywords: ['about', 'servswap', 'platform', 'exchange', 'barter', 'skills', 'talents'],
    intents: ['learn_about', 'understand_concept']
  },
  how_it_works: {
    content: knowledgeBase['how it works'],
    topics: ['general', 'workflow', 'process'],
    keywords: ['how', 'works', 'steps', 'create', 'browse', 'propose', 'marketplace'],
    intents: ['learn_process', 'get_started']
  },
  pricing: {
    content: knowledgeBase['pricing'],
    topics: ['pricing', 'subscription', 'payment'],
    keywords: ['pricing', 'subscription', 'cost', 'fee', 'price', 'monthly', 'annual', 'plan', 'payment'],
    intents: ['learn_pricing', 'compare_plans']
  },
  subscription: {
    content: knowledgeBase['subscription'],
    topics: ['subscription', 'features', 'access'],
    keywords: ['subscription', 'features', 'access', 'unlimited', 'messaging', 'profile', 'customization'],
    intents: ['learn_benefits', 'subscription_features']
  },
  cancel_subscription: {
    content: knowledgeBase['cancel'],
    topics: ['subscription', 'cancellation', 'account'],
    keywords: ['cancel', 'subscription', 'end', 'stop', 'account', 'settings', 'billing'],
    intents: ['cancel_subscription', 'end_membership']
  },
  create_account: {
    content: knowledgeBase['create account'],
    topics: ['account', 'sign up', 'registration'],
    keywords: ['create', 'account', 'sign', 'up', 'email', 'password', 'profile', 'register'],
    intents: ['create_account', 'sign_up', 'get_started', 'join']
  },
  sign_up: {
    content: knowledgeBase['sign up'],
    topics: ['account', 'sign up', 'registration'],
    keywords: ['sign', 'up', 'register', 'create', 'account', 'join', 'email', 'password'],
    intents: ['create_account', 'sign_up', 'get_started', 'join']
  },
  profile: {
    content: knowledgeBase['profile'],
    topics: ['profile', 'account', 'user'],
    keywords: ['profile', 'showcase', 'skills', 'services', 'endorsements', 'updates'],
    intents: ['manage_profile', 'improve_profile']
  },
  verification: {
    content: knowledgeBase['verification'],
    topics: ['verification', 'profile', 'trust', 'security', 'badge'],
    keywords: ['verification', 'badge', 'trust', 'verified', 'verify', 'profile', 'identity', 'document', 'id', 'government', 'two-factor', '2fa', 'authentication', 'blue', 'checkmark'],
    intents: ['get_verified', 'increase_trust', 'improve_profile']
  },
  get_verified: {
    content: knowledgeBase['get verified'],
    topics: ['verification', 'profile', 'trust', 'process', 'steps'],
    keywords: ['verified', 'verification', 'process', 'steps', 'how', 'get', 'become', 'badge', 'check', 'checkmark', 'id', 'identity', 'two-factor', '2fa', 'authentication', 'government', 'profile', 'complete'],
    intents: ['get_verified', 'verification_process']
  },
  verification_badge: {
    content: knowledgeBase['verification badge'],
    topics: ['verification', 'badge', 'trust', 'benefits', 'checkmark'],
    keywords: ['verification', 'badge', 'checkmark', 'blue', 'check', 'trust', 'benefits', 'advantages', 'swaps', 'acceptance', 'identity', 'confirmed'],
    intents: ['learn_benefits', 'get_verified', 'understand_badges']
  },
  service: {
    content: knowledgeBase['service'],
    topics: ['service', 'offering', 'skills'],
    keywords: ['service', 'skill', 'talent', 'expertise', 'offer', 'design', 'lessons', 'classes'],
    intents: ['understand_services', 'offer_service']
  },
  swap: {
    content: knowledgeBase['swap'],
    topics: ['swap', 'exchange', 'transaction'],
    keywords: ['swap', 'exchange', 'services', 'mutual', 'value', 'barter', 'trade'],
    intents: ['understand_swaps', 'make_swap']
  },
  proposal: {
    content: knowledgeBase['proposal'],
    topics: ['proposal', 'swap', 'offer'],
    keywords: ['propose', 'swap', 'initiate', 'navigate', 'user', 'service', 'exchange'],
    intents: ['propose_swap', 'start_exchange']
  },
  contact: {
    content: knowledgeBase['contact'],
    topics: ['contact', 'support', 'help'],
    keywords: ['contact', 'support', 'team', 'email', 'form', 'reach', 'help'],
    intents: ['get_support', 'contact_team']
  }
};

// Function to determine the semantic similarity between two sets of terms
// In a real implementation, this would use embeddings and cosine similarity
// Here we're using a simple Jaccard similarity approach
function calculateSimilarity(terms1: string[], terms2: string[]): number {
  const set1 = new Set(terms1);
  const set2 = new Set(terms2);
  
  // Find the intersection
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  
  // Find the union
  const union = new Set([...set1, ...set2]);
  
  // Calculate Jaccard similarity
  return intersection.size / union.size;
}

// Function to extract key terms from a query
function extractTerms(query: string): string[] {
  // Convert to lowercase
  const lowercaseQuery = query.toLowerCase();
  
  // Remove punctuation and split into words
  const words = lowercaseQuery
    .replace(/[.,?!;:()[\]{}'"\/\\-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0);
  
  // Remove common stop words
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being',
    'in', 'on', 'at', 'by', 'for', 'with', 'about', 'to', 'from', 'of', 'as',
    'i', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yours', 'yourself',
    'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
    'we', 'us', 'our', 'ours', 'ourselves', 'they', 'them', 'their', 'theirs', 'themselves',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    'do', 'does', 'did', 'doing', 'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might',
    'and', 'but', 'or', 'nor', 'if', 'then', 'else', 'when', 'where', 'how',
    'all', 'any', 'both', 'each', 'more', 'most', 'some', 'such',
    'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very'
  ]);
  
  return words.filter(word => !stopWords.has(word));
}

// Function to detect intent from a query
function detectIntent(query: string): string[] {
  const lowercaseQuery = query.toLowerCase();
  const queryTerms = extractTerms(query);
  
  // Define common intent patterns
  const intentPatterns: Record<string, RegExp[]> = {
    'create_account': [
      /how (can|do) i (create|make|get|open|set up) an? account/i,
      /how (can|do) i (sign|register) up/i,
      /how (to|do i) (join|become a member)/i,
      /(want|need|looking) to (create|make) an? account/i
    ],
    'learn_pricing': [
      /how much (does it|do you|will it) cost/i,
      /what( is|'s| are) the (price|pricing|cost|fee)/i,
      /(subscription|membership) (cost|price|fee)/i
    ],
    'understand_swaps': [
      /how (do|does) (swap|swapping|exchange) (work|happen)/i,
      /what is a swap/i,
      /how (can|do) i swap/i
    ],
    'get_support': [
      /how (can|do) i (contact|reach) (you|support|help)/i,
      /(need|want) (help|support|assistance)/i
    ],
    'get_verified': [
      /how (can|do) i (get|become|apply for) verified/i,
      /how (does|do) (verification|verify|verifying) work/i,
      /how (to|do i) get a (verification badge|verified status|verified account)/i,
      /(want|need|looking) to (get|become) verified/i,
      /what (is|are) the (verification|verified) (process|steps|requirements)/i,
      /how (can|do) i get the (blue|verification) (checkmark|badge)/i,
      /what('s| is) (needed|required) (for|to get) verification/i,
      /verification (cost|price|fee)/i,
      /what do i need for (verification|getting verified)/i,
      /do i need (two-factor|2fa|authentication) for verification/i
    ],
    'verification_benefits': [
      /what( are|'s) the benefits of (verification|being verified|getting verified)/i,
      /why (should|would) i get verified/i,
      /what( does|'s) the verification badge (do|mean|represent)/i,
      /does (verification|being verified) (help|improve) (my profile|visibility|swaps)/i
    ]
  };
  
  // Check for intent matches
  const matchedIntents: string[] = [];
  
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(lowercaseQuery)) {
        matchedIntents.push(intent);
        break;
      }
    }
  }
  
  return matchedIntents;
}

// Enhanced AI response function that uses semantic matching
const getAIResponse = (query: string): string => {
  // Extract key terms from the query
  const queryTerms = extractTerms(query);
  
  // Detect intents
  const queryIntents = detectIntent(query);
  
  // Calculate similarity scores for each knowledge entry
  const entryScores: { id: string; score: number; content: string }[] = [];
  
  for (const [id, entry] of Object.entries(enhancedKnowledgeBase)) {
    // Calculate term similarity
    const termSimilarity = calculateSimilarity(queryTerms, [
      ...entry.keywords,
      ...entry.topics
    ]);
    
    // Calculate intent similarity
    let intentScore = 0;
    if (queryIntents.length > 0 && entry.intents.length > 0) {
      intentScore = calculateSimilarity(queryIntents, entry.intents);
    }
    
    // Total score with weighted components
    // Intents are given higher importance 
    const totalScore = termSimilarity * 0.6 + intentScore * 0.4;
    
    entryScores.push({
      id,
      score: totalScore,
      content: entry.content
    });
  }
  
  // Sort by highest score
  entryScores.sort((a, b) => b.score - a.score);
  
  // Get the top match if it exceeds a minimum threshold
  const topMatch = entryScores[0];
  if (topMatch && topMatch.score > 0.15) {
    return topMatch.content;
  }
  
  // Fallback to the old method for backward compatibility
  const lowercaseQuery = query.toLowerCase();
  
  // Check for direct matches in the original knowledge base
  for (const [keyword, response] of Object.entries(knowledgeBase)) {
    if (lowercaseQuery.includes(keyword)) {
      return response;
    }
  }
  
  // Topic matches as fallback
  const topicMatches: Record<string, string> = {
    // Pricing related
    'cost': knowledgeBase['pricing'],
    'price': knowledgeBase['pricing'],
    'fee': knowledgeBase['pricing'],
    'pay': knowledgeBase['pricing'],
    'membership': knowledgeBase['subscription'],
    'plan': knowledgeBase['subscription'],
    
    // Account related
    'account': knowledgeBase['create account'],
    'signup': knowledgeBase['sign up'],
    'join': knowledgeBase['sign up'],
    'create': knowledgeBase['create account'],
    'get started': knowledgeBase['create account'],
    'new user': knowledgeBase['create account'],
    'register': knowledgeBase['register'],
    'log in': "To log in to your ServSwap account, click the 'Log In' button in the top-right corner of our homepage. Enter your email and password to access your account.",
    
    // Service related
    'offer': knowledgeBase['service'],
    'skill': knowledgeBase['service'],
    'talent': knowledgeBase['service'],
    'exchange': knowledgeBase['swap'],
    'trade': knowledgeBase['swap'],
    'barter': knowledgeBase['swap'],
    
    // Support related
    'help': knowledgeBase['contact'],
    'support': knowledgeBase['contact'],
    'problem': knowledgeBase['contact'],
    'issue': knowledgeBase['contact'],
    
    // Policy related
    'rules': knowledgeBase['terms'],
    'guidelines': knowledgeBase['terms'],
    'policy': knowledgeBase['privacy'],
    'data': knowledgeBase['privacy'],
    'information': knowledgeBase['privacy'],
  };
  
  for (const [term, response] of Object.entries(topicMatches)) {
    if (lowercaseQuery.includes(term)) {
      return response;
    }
  }
  
  // Pattern recognition as a last resort
  if (lowercaseQuery.match(/how (can|do) i (create|make|get|start|open|set up) an? account/i)) {
    return knowledgeBase['create account'];
  }
  
  if (lowercaseQuery.match(/how (can|do) i sign up/i)) {
    return knowledgeBase['sign up'];
  }
  
  // Fallback response
  return "I don't have specific information about that yet. For personalized assistance, please contact our support team at support@servswap.com or visit our FAQ page at servswap.com/faq.";
};

// Type for the request body
interface ChatRequest {
  message: string;
  conversationHistory?: Array<{ text: string; isUser: boolean }>;
}

// Function to consider conversation history for better responses
function getContextAwareResponse(query: string, history: Array<{ text: string; isUser: boolean }> = []): string {
  // Extract the last few messages for context (skip the current query)
  const recentHistory = history.slice(-4);
  const lastBotMessage = recentHistory.filter(msg => !msg.isUser).pop()?.text || '';
  const lastUserMessage = recentHistory.filter(msg => msg.isUser).pop()?.text || '';
  
  // Get the base response
  let response = getAIResponse(query);
  
  // Check for follow-up questions by detecting if the current query is continuing a topic
  // from the previous exchange
  if (lastBotMessage.toLowerCase().includes('account') && query.toLowerCase().match(/how|what|where|when|why|can i/i)) {
    // Likely a follow-up about accounts
    if (query.toLowerCase().includes('forgot') || query.toLowerCase().includes('reset')) {
      return "If you forgot your password, click the 'Forgot Password' link on the login page. We'll send you an email with instructions to reset it.";
    }
    
    if (query.toLowerCase().includes('delete') || query.toLowerCase().includes('remove')) {
      return "To delete your account, go to Account Settings > Privacy, then click 'Delete Account'. Please note this action is permanent and will remove all your data.";
    }
  }
  
  // If the user is asking for clarification on the previous response
  if (query.toLowerCase().match(/what do you mean|explain|clarify|don't understand|didn't understand/i)) {
    if (lastBotMessage.includes('subscription')) {
      return "Let me clarify about our subscription plans. ServSwap offers monthly ($10) or annual ($99) plans. The subscription gives you the ability to propose service swaps and message other users. Without a subscription, you can browse services but can't initiate exchanges.";
    }
    
    if (lastBotMessage.includes('profile')) {
      return "Your profile is your digital identity on ServSwap. It showcases your skills, services you offer, and your reputation through reviews and endorsements. A complete and detailed profile increases your chances of successful service exchanges.";
    }
  }
  
  // If the query seems short/vague but we have context from previous exchanges
  if (query.length < 10 && recentHistory.length > 0) {
    const recentTopics = recentHistory
      .map(msg => msg.text.toLowerCase())
      .join(' ')
      .match(/account|subscription|profile|service|swap|exchange|verification|payment|cancel|refund/g) || [];
    
    // If we detect relevant topics in recent conversation
    const topicSet = new Set(recentTopics);
    if (topicSet.size > 0) {
      // Append contextual information to the response
      response += ` If you need more specific information about ${Array.from(topicSet).join(', ')}, please let me know!`;
    }
  }
  
  return response;
}

// In a production environment, this would connect to OpenAI, Anthropic, or another LLM provider
export async function POST(request: Request) {
  try {
    const data = await request.json() as ChatRequest;
    
    if (!data.message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    // Get response from local knowledge base using enhanced semantic search with context
    const response = getContextAwareResponse(data.message, data.conversationHistory);
    
    // In production, you'd do something like:
    /*
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Convert messages to OpenAI format
    const messages = [
      { role: 'system', content: 'You are a helpful assistant for ServSwap, a service exchange platform.' },
      ...data.conversationHistory?.map(msg => ({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.text
      })) || [],
      { role: 'user', content: data.message }
    ];
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.7,
      max_tokens: 500
    });
    
    const response = completion.choices[0].message.content;
    */
    
    // Return the AI response
    return NextResponse.json({
      message: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
} 